const MENTAL_AVATAR_URL = 'http://localhost:5174'

export default function MentalAvatarFrame() {
  return (
    <iframe
      src={MENTAL_AVATAR_URL}
      title="멘탈 아바타"
      className="w-full h-full border-0"
      allow="microphone; camera; autoplay; clipboard-write"
    />
  )
}
