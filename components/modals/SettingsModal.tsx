import React, { useState } from 'react';
import { X, User, Bell, Blocks, Palette, Shield } from 'lucide-react';
import { UserProfile } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile?: UserProfile | null;
}

type TabId = 'account' | 'notifications' | 'integrations' | 'appearance' | 'security';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userProfile }) => {
  const [activeTab, setActiveTab] = useState<TabId>('account');

  if (!isOpen) return null;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: 'Account', icon: <User size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'integrations', label: 'Integrations', icon: <Blocks size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'security', label: 'Security', icon: <Shield size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#F9F8F6] rounded-[24px] shadow-[0_20px_40px_-12px_rgba(58,92,52,0.2)] border border-[#5F2427]/10 w-full max-w-3xl h-[600px] max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#5F2427]/5 shrink-0 bg-white">
          <div className="flex items-center h-10 bg-white rounded-xl shadow-sm border border-[#5F2427]/10 overflow-hidden no-scrollbar">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    h-full px-4 flex items-center gap-2 text-[13px] font-medium transition-colors border-r border-[#5F2427]/5 last:border-r-0 whitespace-nowrap
                    ${isActive 
                      ? 'bg-[#3A5C34]/10 text-[#3A5C34]' 
                      : 'text-[#5F2427]/60 hover:bg-[#5F2427]/5 hover:text-[#5F2427]'
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm border border-[#5F2427]/10 text-[#5F2427]/60 hover:bg-[#FCCAE2] hover:text-[#5F2427] hover:border-[#FCCAE2] transition-all shrink-0 ml-4"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#F9F8F6]">
          {activeTab === 'account' && (
            <div className="space-y-8 max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-[#5F2427] mb-1">Profile Information</h3>
                <p className="text-[13px] text-[#5F2427]/60 mb-6">Update your account's profile information and email address.</p>
                
                <div className="space-y-5 bg-white p-6 rounded-2xl shadow-sm border border-[#5F2427]/10">
                  <div>
                    <label className="block text-[13px] font-medium text-[#5F2427] mb-2">Full Name</label>
                    <input 
                      type="text" 
                      defaultValue={userProfile?.full_name || ''}
                      className="w-full bg-[#F9F8F6] border border-[#5F2427]/10 rounded-xl px-4 py-3 text-[14px] text-[#5F2427] focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-[#5F2427] mb-2">Email Address</label>
                    <input 
                      type="email" 
                      defaultValue={userProfile?.email || ''}
                      disabled
                      className="w-full bg-[#F9F8F6]/50 border border-[#5F2427]/5 rounded-xl px-4 py-3 text-[14px] text-[#5F2427]/50 outline-none cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div>
                <h3 className="text-lg font-semibold text-[#5F2427] mb-1">Connected Apps</h3>
                <p className="text-[13px] text-[#5F2427]/60 mb-6">Connect your favorite tools to streamline your workflow.</p>
                
                <div className="grid gap-4">
                  {[
                    { name: 'Slack', desc: 'Send notifications to Slack channels', connected: true },
                    { name: 'Google Drive', desc: 'Import and export files directly', connected: false },
                    { name: 'Figma', desc: 'Embed designs into your whiteboards', connected: false },
                    { name: 'GitHub', desc: 'Link commits and pull requests', connected: true },
                  ].map(app => (
                    <div key={app.name} className="flex items-center justify-between p-4 bg-white border border-[#5F2427]/10 rounded-2xl shadow-sm hover:shadow-md hover:border-[#5F2427]/20 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#F9F8F6] flex items-center justify-center text-[#5F2427]/40">
                          <Blocks size={24} />
                        </div>
                        <div>
                          <h4 className="text-[15px] font-semibold text-[#5F2427]">{app.name}</h4>
                          <p className="text-[13px] text-[#5F2427]/60">{app.desc}</p>
                        </div>
                      </div>
                      <button className={`px-5 py-2 rounded-xl text-[13px] font-medium transition-all active:scale-95 ${
                        app.connected 
                          ? 'bg-[#F9F8F6] text-[#5F2427]/60 hover:bg-[#5F2427]/5 border border-[#5F2427]/10' 
                          : 'bg-[#3A5C34] text-[#FFD753] hover:bg-[#2d4a29] shadow-sm'
                      }`}>
                        {app.connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'account' && activeTab !== 'integrations' && (
            <div className="flex flex-col items-center justify-center h-full text-center text-[#5F2427]/60 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-[24px] bg-white shadow-sm border border-[#5F2427]/10 flex items-center justify-center mb-4">
                <Blocks size={24} className="text-[#5F2427]/40" />
              </div>
              <h3 className="text-[15px] font-medium text-[#5F2427] mb-1">Coming Soon</h3>
              <p className="text-[13px]">This settings category is currently under development.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
