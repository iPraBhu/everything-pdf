import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import process from 'node:process'
import { chromium } from 'playwright-core'

const host = '127.0.0.1'
const preferredPort = Number(process.env.TOOL_TEST_PORT || 4173)
const shouldBuild = process.argv.includes('--build')
const distShellPath = 'dist/tool-test-shell.html'

function getNpmInvocation(args) {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', ['npm', ...args].join(' ')]
    }
  }

  return {
    command: 'npm',
    args
  }
}

function getBrowserPath() {
  if (process.env.TOOL_TEST_BROWSER_PATH) {
    return process.env.TOOL_TEST_BROWSER_PATH
  }

  if (process.platform === 'win32') {
    return 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  }

  return undefined
}

function getBaseUrl(port) {
  return `http://${host}:${port}`
}

function getShellUrl(port) {
  return `${getBaseUrl(port)}/tests/tool-test-shell.html`
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TOOL_TEST_MODE: '1'
      },
      stdio: 'inherit',
      shell: false
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

async function waitForServer(url, timeoutMs = 60_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.ok) {
        return
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for dev server at ${url}`)
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer()

    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    server.listen(port, host)
  })
}

async function choosePort(startPort) {
  let port = startPort

  while (!(await isPortAvailable(port))) {
    port += 1
  }

  return port
}

function startViteServer(port) {
  const invocation = getNpmInvocation(['run', 'preview', '--', '--host', host, '--port', String(port), '--strictPort'])
  const child = spawn(invocation.command, invocation.args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TOOL_TEST_MODE: '1'
    },
    stdio: 'inherit',
    shell: false
  })

  return child
}

function printSummary(summary) {
  console.log('')
  console.log(`Tool tests: ${summary.passed}/${summary.total} passed, ${summary.failed} failed`)

  for (const result of summary.results) {
    const prefix = result.status === 'passed' ? 'PASS' : 'FAIL'
    console.log(`${prefix} ${result.id} (${result.durationMs}ms) - ${result.details}`)
  }
}

async function main() {
  const port = await choosePort(preferredPort)
  const shellUrl = `${getBaseUrl(port)}/tool-test-shell.html`

  if (shouldBuild || !existsSync(distShellPath)) {
    const invocation = getNpmInvocation(['run', 'build'])
    await runCommand(invocation.command, invocation.args)
  }

  const server = startViteServer(port)
  const browserPath = getBrowserPath()
  let browser

  const shutdown = () => {
    if (!server.killed) {
      server.kill()
    }
  }

  process.on('exit', shutdown)
  process.on('SIGINT', () => {
    shutdown()
    process.exit(130)
  })

  try {
    await waitForServer(shellUrl)

    browser = await chromium.launch({
      executablePath: browserPath,
      headless: true
    })

    const page = await browser.newPage()
    page.setDefaultTimeout(600_000)
    page.on('console', (message) => {
      console.log(`[browser:${message.type()}] ${message.text()}`)
    })
    page.on('pageerror', (error) => {
      console.error(`[browser:error] ${error.message}`)
    })

    await page.goto(shellUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    await page.waitForFunction(() => window.__toolTestStatus?.state === 'done' || window.__toolTestStatus?.state === 'failed')

    const status = await page.evaluate(() => window.__toolTestStatus)
    if (!status) {
      throw new Error('Tool harness did not publish a status object.')
    }

    if (status.state === 'failed') {
      throw new Error(status.error || 'Tool harness failed before producing a summary.')
    }

    const summary = status.summary
    printSummary(summary)

    if (summary.failed > 0) {
      process.exitCode = 1
    }
  } finally {
    if (browser) {
      await browser.close()
    }
    shutdown()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
