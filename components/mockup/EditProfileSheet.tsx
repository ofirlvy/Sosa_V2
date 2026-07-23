import React, { useRef, useState } from 'react';
import { MockupProfile } from '../../types';
import { ResolvedMockupProfile } from '../../services/mockupProfile';
import { PhoneSheet, SheetField } from './PhoneSheet';
import { uploadOptimistic } from './mockupUpload';

/**
 * Instagram-style "Edit profile" screen rendered inside the phone mockup.
 *
 * Text fields follow the familiar Cancel/Done model (nothing is written until
 * Done). The profile photo is the exception: it commits the moment it uploads,
 * exactly like the real app — and that also avoids stranding an upload promise
 * that resolves after the sheet closed.
 *
 * Leaving a field blank is meaningful: it clears the override so the field
 * falls back to the brand's own name/picture (see resolveMockupProfile).
 */
export const EditProfileSheet: React.FC<{
  profile: ResolvedMockupProfile;
  stored?: MockupProfile;
  onCommit: (patch: Partial<MockupProfile>) => void;
  onClose: () => void;
}> = ({ profile, stored, onCommit, onClose }) => {
  // Seed from what's STORED, not from the resolved values — otherwise opening
  // and saving the sheet would freeze the brand's fallbacks into overrides.
  const [displayName, setDisplayName] = useState(stored?.displayName ?? '');
  const [username, setUsername] = useState(stored?.username ?? '');
  const [bio, setBio] = useState(stored?.bio ?? '');
  const [link, setLink] = useState(stored?.link ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadOptimistic(file, (url) => onCommit({ avatarUrl: url }));
  };

  const done = () => {
    onCommit({ displayName, username, bio, link });
    onClose();
  };

  return (
    <PhoneSheet title="Edit profile" onCancel={onClose} onDone={done}>
      <div className="py-5 flex flex-col items-center gap-2">
        <img src={profile.avatarUrl} alt="" className="w-[88px] h-[88px] rounded-full object-cover bg-neutral-100" />
        <button onClick={() => fileRef.current?.click()} className="text-[14px] font-semibold text-[#0095F6] hover:opacity-70">
          Change profile photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
      </div>

      <SheetField label="Name" value={displayName} onChange={setDisplayName} placeholder={profile.displayName} />
      <SheetField label="Username" value={username} onChange={setUsername} placeholder={profile.username} prefix="@" />
      <SheetField label="Bio" value={bio} onChange={setBio} placeholder="Tell people about the brand" multiline />
      <SheetField label="Link" value={link} onChange={setLink} placeholder="yourbrand.com" />

      <p className="px-4 py-3 text-[11px] leading-snug text-[#8E8E8E]">
        Leave a field empty to use the brand's own name and picture.
      </p>
    </PhoneSheet>
  );
};
