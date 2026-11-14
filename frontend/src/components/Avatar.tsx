interface AvatarProps {
  name: string
  avatar?: string | null
  size?: number  // Tailwind unit (1 unit = 4px), e.g. size=9 → 36px
}

export default function Avatar({ name, avatar, size = 9 }: AvatarProps) {
  const px = size * 4

  if (avatar?.startsWith('local:')) {
    const parts = avatar.split(':')
    const emoji = parts[1]
    const color = parts[2]
    return (
      <div style={{
        width: px, height: px, minWidth: px,
        backgroundColor: `#${color}`,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: px * 0.55, lineHeight: 1 }}>{emoji}</span>
      </div>
    )
  }

  if (avatar?.startsWith('http') || avatar?.startsWith('data:')) {
    return (
      <img
        src={avatar}
        alt={name}
        style={{ width: px, height: px, minWidth: px }}
        className="rounded-full object-cover bg-gray-100 shrink-0"
      />
    )
  }

  return (
    <div style={{ width: px, height: px, minWidth: px, fontSize: px * 0.38 }}
      className="rounded-full bg-primary-500 flex items-center justify-center text-white font-bold shrink-0">
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}
