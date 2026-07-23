import React from 'react';

/**
 * A full-screen sheet that lives INSIDE the phone mockup's screen (not a page
 * modal) — the way Instagram's own "Edit profile" screen slides up over the
 * profile. Absolutely positioned over the scroll area of the phone screen.
 */
export const PhoneSheet: React.FC<{
  title: string;
  onCancel: () => void;
  /** Right-hand action. Omit for editors that commit on every change. */
  onDone?: () => void;
  doneLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
}> = ({ title, onCancel, onDone, doneLabel = 'Done', cancelLabel = 'Cancel', children }) => (
  <div className="absolute inset-0 z-30 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
    <div className="h-12 shrink-0 px-4 flex items-center justify-between border-b border-[#DBDBDB]">
      <button onClick={onCancel} className="text-[14px] text-[#262626] hover:opacity-60">{cancelLabel}</button>
      <span className="text-[15px] font-semibold text-[#262626]">{title}</span>
      {onDone
        ? <button onClick={onDone} className="text-[14px] font-semibold text-[#0095F6] hover:opacity-70">{doneLabel}</button>
        : <span className="w-10" />}
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">{children}</div>
  </div>
);

/** Labelled text row in the Instagram edit-profile style. */
export const SheetField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  prefix?: string;
}> = ({ label, value, onChange, placeholder, multiline, prefix }) => (
  <label className="block px-4 py-2.5 border-b border-[#EFEFEF]">
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#8E8E8E]">{label}</span>
    <span className="flex items-start gap-1">
      {prefix && <span className="text-[14px] text-[#8E8E8E] pt-1.5">{prefix}</span>}
      {multiline ? (
        <textarea
          dir="auto" rows={3} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 mt-1 text-[14px] text-[#262626] bg-transparent outline-none resize-none placeholder:text-[#C7C7C7]"
        />
      ) : (
        <input
          dir="auto" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 mt-1 text-[14px] text-[#262626] bg-transparent outline-none placeholder:text-[#C7C7C7]"
        />
      )}
    </span>
  </label>
);
