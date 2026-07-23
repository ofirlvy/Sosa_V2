
import React, { useState } from 'react';
import { updateUserProfile, createBrand } from '../../services/supabase';
import { fileToDataUrl, isWithinSizeLimit, sizeLimitMessage } from '../../services/fileService';
import { AuthLayout } from './AuthLayout';
import { User, Users, Building, ArrowRight, Loader2, Upload, X } from 'lucide-react';

interface OnboardingFlowProps {
  userId: string;
  onComplete: () => void;
}

type Step = 'account_type' | 'brand_setup';

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ userId, onComplete }) => {
  const [step, setStep] = useState<Step>('account_type');
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [accountType, setAccountType] = useState<'individual' | 'team' | null>(null);
  const [brandName, setBrandName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleAccountTypeSelect = async (type: 'individual' | 'team') => {
    setAccountType(type);
    if (type === 'individual') {
      // For individual, we just mark complete and go
      setLoading(true);
      const ok = await updateUserProfile(userId, { account_type: type, onboarding_complete: true });
      setLoading(false);
      // Only advance if the write actually persisted — otherwise onboarding would
      // re-fire on next login (onboarding_complete never reached the DB).
      if (!ok) { alert('Could not save your choice. Please check your connection and try again.'); return; }
      onComplete();
    } else {
      // For team, we go to next step
      setStep('brand_setup');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!isWithinSizeLimit(file)) { alert(sizeLimitMessage()); return; }
      setLogoFile(file);
      setLogoPreview(await fileToDataUrl(file));
    }
  };

  const finishOnboarding = async () => {
    setLoading(true);
    try {
      // 1. Update Profile — only proceed if it actually persisted.
      const ok = await updateUserProfile(userId, { account_type: 'team', onboarding_complete: true });
      if (!ok) { alert('Could not save your workspace. Please check your connection and try again.'); setLoading(false); return; }

      // 2. Create Brand (if name provided)
      if (brandName.trim()) {
        // Note: Real file upload would happen here to Storage bucket.
        // For now we simulate the URL.
        const mockLogoUrl = logoPreview || undefined;
        await createBrand({
          name: brandName,
          owner_id: userId,
          logo_url: mockLogoUrl
        });
      }
      
      onComplete();
    } catch (e) {
      console.error("Onboarding error", e);
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 1: Account Type ---
  if (step === 'account_type') {
    return (
      <AuthLayout 
        title="How will you use Sosa?"
        subtitle="We'll customize your workspace based on your needs."
      >
        <div className="space-y-4">
          <button 
            onClick={() => handleAccountTypeSelect('individual')}
            disabled={loading}
            className="w-full flex items-center p-4 border border-gray-200 rounded-2xl hover:border-[#3A5C34] hover:bg-[#3A5C34]/5 transition-all group text-left"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:text-[#3A5C34] transition-colors shadow-sm">
              <User size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-[15px] font-bold text-[#1C1C1E]">Individual</h3>
              <p className="text-[13px] text-gray-500">For freelancers and solo creators.</p>
            </div>
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[#3A5C34]">
              <ArrowRight size={20} />
            </div>
          </button>

          <button 
            onClick={() => handleAccountTypeSelect('team')}
            disabled={loading}
            className="w-full flex items-center p-4 border border-gray-200 rounded-2xl hover:border-[#3A5C34] hover:bg-[#3A5C34]/5 transition-all group text-left"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 group-hover:bg-white group-hover:text-[#3A5C34] transition-colors shadow-sm">
              <Users size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-[15px] font-bold text-[#1C1C1E]">Team / Brand</h3>
              <p className="text-[13px] text-gray-500">Collaborate on campaigns and assets.</p>
            </div>
            <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[#3A5C34]">
              <ArrowRight size={20} />
            </div>
          </button>
        </div>
      </AuthLayout>
    );
  }

  // --- STEP 2: Brand Setup ---
  return (
    <AuthLayout
      title="Set up your brand"
      subtitle="Establish your team identity."
    >
      <div className="space-y-6">
        
        {/* Logo Upload Simulation */}
        <div className="flex justify-center">
          <div className="relative group">
            <div className={`w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-all ${logoPreview ? 'border-transparent shadow-lg' : 'border-gray-200 hover:border-[#3A5C34] bg-gray-50 hover:bg-gray-100'}`}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-gray-400">
                  <Upload size={24} className="mx-auto mb-1" />
                  <span className="text-[10px] font-bold uppercase">Logo</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleLogoUpload}
              />
            </div>
            {logoPreview && (
              <button 
                onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md text-red-500 hover:scale-110 transition-transform"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#5F2427] mb-1.5 ml-1">Brand Name</label>
          <div className="relative">
            <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-gray-50 border border-gray-200 text-[#1C1C1E] focus:bg-white focus:ring-2 focus:ring-[#3A5C34]/20 focus:border-[#3A5C34] transition-all outline-none text-[15px]"
              placeholder="Acme Corp."
            />
          </div>
        </div>

        <button
          onClick={finishOnboarding}
          disabled={loading || !brandName.trim()}
          className="w-full h-12 bg-[#3A5C34] hover:bg-[#2d4a29] text-white rounded-full font-semibold text-[15px] shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <>Create Workspace <ArrowRight size={16} /></>}
        </button>

        <button
          onClick={finishOnboarding}
          className="w-full text-[13px] text-gray-400 font-medium hover:text-[#5F2427] transition-colors"
        >
          I'll do this later
        </button>
      </div>
    </AuthLayout>
  );
};
