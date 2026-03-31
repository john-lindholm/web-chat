import EmojiPicker from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';

interface EmojiPickerProps {
  onEmojiClick: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPickerComponent({ onEmojiClick, onClose }: EmojiPickerProps) {
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiClick(emojiData.emoji);
    onClose();
  };

  return (
    <div className="emoji-picker-container">
      <EmojiPicker
        onEmojiClick={handleEmojiClick}
        searchPlaceholder="Search emoji..."
        emojiStyle="native"
        width={350}
        height={450}
      />
    </div>
  );
}
