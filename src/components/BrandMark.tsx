interface BrandMarkProps {
  className?: string
  imageClassName?: string
  alt?: string
}

export function BrandMark({
  className = '',
  imageClassName = '',
  alt = 'Free Everything PDF logo'
}: BrandMarkProps) {
  return (
    <div className={className}>
      <img
        src="/logo.png"
        alt={alt}
        className={`h-full w-full object-contain ${imageClassName}`.trim()}
      />
    </div>
  )
}
