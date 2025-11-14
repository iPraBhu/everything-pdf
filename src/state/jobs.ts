import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'processing'

export interface JobProgress {
  current: number
  total: number
  message?: string
}

export type JobProgressValue = JobProgress | number

export interface Job {
  id: string
  type: string
  name: string
  status: JobStatus
  progress?: JobProgressValue
  startTime: number
  endTime?: number
  error?: string
  result?: unknown
  cancellable: boolean
  fileIds: string[]
  cancel?: () => void
}

export interface JobsState {
  jobs: Job[]
  
  // Actions
  addJob: (job: Job) => void
  updateJob: (jobId: string, updates: Partial<Job>) => void
  removeJob: (jobId: string) => void
  cancelJob: (jobId: string) => void
  clearCompletedJobs: () => void
  clearAllJobs: () => void
  
  // Getters
  getRunningJobs: () => Job[]
  getJobsByFileId: (fileId: string) => Job[]
  hasRunningJobs: () => boolean
}

export const useJobsStore = create<JobsState>()(
  devtools(
    (set, get) => ({
      jobs: [],
      
      addJob: (job) => set((state) => ({
        jobs: [...state.jobs, job]
      })),
      
      updateJob: (jobId, updates) => set((state) => ({
        jobs: state.jobs.map(job => 
          job.id === jobId ? { ...job, ...updates } : job
        )
      })),
      
      removeJob: (jobId) => set((state) => ({
        jobs: state.jobs.filter(job => job.id !== jobId)
      })),
      
      cancelJob: (jobId) => {
        const job = get().jobs.find(j => j.id === jobId)
        if (job && job.cancel) {
          job.cancel()
        }
        get().updateJob(jobId, { status: 'cancelled' })
      },
      
      clearCompletedJobs: () => set((state) => ({
        jobs: state.jobs.filter(job => 
          job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled'
        )
      })),
      
      clearAllJobs: () => set({ jobs: [] }),
      
      getRunningJobs: () => get().jobs.filter(job => 
        job.status === 'running' || job.status === 'pending'
      ),
      
      getJobsByFileId: (fileId) => get().jobs.filter(job => 
        job.fileIds.includes(fileId)
      ),
      
      hasRunningJobs: () => get().jobs.some(job => 
        job.status === 'running' || job.status === 'pending'
      )
    }),
    { name: 'jobs-store' }
  )
)