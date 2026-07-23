import React, { useState, useEffect } from 'react';
import { BaseCard } from './BaseCard';
import { CardData, PinterestCardContent, PinItem } from '../../types';
import { LogIn, LogOut, RefreshCw, ExternalLink, ShieldCheck, Lock, Loader2, AlertCircle } from 'lucide-react';

const PINTEREST_APP_ID = import.meta.env.VITE_PINTEREST_APP_ID || '';
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/pinterest/callback` : '';
const SCOPE = 'boards:read,pins:read,user_accounts:read';

interface PinterestCardProps {
  card: CardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onUpdateContent: (id: string, content: any) => void;
  onResize: (id: string, geometry: { width: number; height: number; x?: number; y?: number }) => void;
  zoomScale: number;
}

export const PinterestCard: React.FC<PinterestCardProps> = (props) => {
  const { card, onUpdateContent } = props;
  const content = card.content as PinterestCardContent;
  
  // Local state for interactions
  const [isHoveringPin, setIsHoveringPin] = useState<string | null>(null);
  
  // Auth Flow State
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoadingPins, setIsLoadingPins] = useState(false);

  // Initialize content if empty
  useEffect(() => {
    if (content.isConnected === undefined) {
      onUpdateContent(card.id, {
        isConnected: false,
        pins: []
      });
    }
  }, []);

  // --- REAL OAUTH 2.0 IMPLEMENTATION ---

  const initiateOAuth = () => {
    if (!PINTEREST_APP_ID) {
      setAuthError("Pinterest not configured. Add VITE_PINTEREST_APP_ID to your .env.local file.");
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    setAuthStatus("Connecting to Pinterest...");

    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('pinterest_auth_state', state);

    // Construct the OFFICIAL Pinterest OAuth URL
    const authUrl = `https://www.pinterest.com/oauth/` +
      `?client_id=${PINTEREST_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPE)}` +
      `&state=${state}`;

    // Open System Browser Window
    const width = 600;
    const height = 750;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      authUrl, 
      'PinterestAuth', 
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
    );

    setAuthStatus("Waiting for approval in popup...");
  };

  // Listen for the Backend Callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security: Validate origin in production
      // if (event.origin !== "https://your-backend-api.com") return;

      const { type, payload } = event.data;

      if (type === 'PINTEREST_AUTH_SUCCESS' && payload.token) {
        setAuthStatus("Verifying token...");
        await fetchRealPins(payload.token);
        setIsAuthenticating(false);
      } 
      
      if (type === 'PINTEREST_AUTH_FAILURE') {
        setAuthError("Authentication failed. Please try again.");
        setIsAuthenticating(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- REAL API DATA FETCHING ---

  const fetchRealPins = async (accessToken: string) => {
    setIsLoadingPins(true);
    try {
      // 1. Fetch User Profile
      const userRes = await fetch('https://api.pinterest.com/v5/user_account', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!userRes.ok) throw new Error('Failed to fetch user profile');
      const userData = await userRes.json();

      // 2. Fetch Pins (Limit 20)
      const pinsRes = await fetch('https://api.pinterest.com/v5/pins?page_size=20', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!pinsRes.ok) throw new Error('Failed to fetch pins');
      const pinsData = await pinsRes.json();

      // 3. Map to Internal Types
      const mappedPins: PinItem[] = pinsData.items.map((p: any) => ({
        id: p.id,
        imageUrl: p.media.images['600x'].url, // API v5 structure
        link: p.link || `https://pinterest.com/pin/${p.id}`,
        description: p.description || p.title || 'Saved Pin'
      }));

      onUpdateContent(card.id, {
        isConnected: true,
        username: userData.username,
        pins: mappedPins
      });

    } catch (err) {
      console.error(err);
      setAuthError("Failed to fetch data from Pinterest API.");
    } finally {
      setIsLoadingPins(false);
    }
  };

  const handleLogout = () => {
    // In a real app, also call backend to revoke token
    onUpdateContent(card.id, {
      isConnected: false,
      username: undefined,
      pins: []
    });
  };

  const handlePinDragStart = (e: React.DragEvent, pin: PinItem) => {
    e.stopPropagation();
    
    const payload = {
      type: 'PINTEREST_PIN',
      id: pin.id,
      url: pin.imageUrl,
      link: pin.link
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';

    const img = document.createElement('img');
    img.src = pin.imageUrl;
    img.style.width = '80px';
    img.style.height = '80px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '12px';
    document.body.appendChild(img);
    e.dataTransfer.setDragImage(img, 40, 40);
    setTimeout(() => document.body.removeChild(img), 0);
  };

  // Pinterest Icon SVG - Using Burgundy to fit palette
  const PinterestIcon = (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-[#5F2427]">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.399.165-1.487-.695-2.419-2.875-2.419-4.629 0-3.773 2.749-7.253 7.951-7.253 4.173 0 7.41 2.967 7.41 6.923 0 4.133-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
    </svg>
  );

  return (
    <BaseCard 
      {...props} 
      title="Pinterest" 
      icon={PinterestIcon}
      accentColor="#5F2427"
    >
      <div className="flex flex-col h-full bg-white relative">
        
        {content.isConnected ? (
          // --- STATE: CONNECTED ---
          <>
            {/* Header Toolbar */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between no-drag">
               <div className="flex items-center gap-2">
                 <div className="w-6 h-6 rounded-full bg-[#5F2427] text-white flex items-center justify-center text-[10px] font-bold">
                   {content.username?.charAt(0).toUpperCase() || 'U'}
                 </div>
                 <span className="text-[13px] font-semibold text-gray-700">@{content.username}</span>
               </div>
               <button 
                 onClick={handleLogout}
                 className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-[#5F2427] transition-colors"
                 title="Disconnect"
               >
                 <LogOut size={14} />
               </button>
            </div>

            {/* Pins Grid */}
            <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                {isLoadingPins ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                     <Loader2 size={24} className="animate-spin mb-2" />
                     <span className="text-[12px]">Importing Pins...</span>
                  </div>
                ) : (
                  <div className="columns-2 gap-2 space-y-2">
                      {content.pins?.map((pin) => (
                          <div 
                            key={pin.id} 
                            className="relative group mb-2 break-inside-avoid"
                            onMouseEnter={() => setIsHoveringPin(pin.id)}
                            onMouseLeave={() => setIsHoveringPin(null)}
                          >
                              <img 
                                src={pin.imageUrl} 
                                alt={pin.description}
                                className="w-full rounded-xl object-cover hover:brightness-90 transition-all cursor-grab active:cursor-grabbing no-drag"
                                draggable
                                onDragStart={(e) => handlePinDragStart(e, pin)}
                              />
                              
                              {/* Hover Overlay */}
                              <div className={`
                                  absolute inset-0 bg-black/20 rounded-xl transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none
                                  ${isHoveringPin === pin.id ? 'opacity-100' : 'opacity-0'}
                              `}>
                                  <div className="flex justify-between items-end pointer-events-auto">
                                      <span className="text-white text-[11px] font-bold drop-shadow-md line-clamp-1">{pin.description}</span>
                                      <a 
                                        href={pin.link} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                          <ExternalLink size={10} />
                                      </a>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {content.pins?.length === 0 && (
                        <div className="col-span-2 text-center py-8 text-gray-400 text-[13px]">
                           No pins found on your public boards.
                        </div>
                      )}
                  </div>
                )}
            </div>
            
            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-medium">
               <span>{content.pins?.length || 0} Pins Available</span>
               <div className="flex items-center gap-1 cursor-pointer hover:text-gray-600">
                  <RefreshCw size={10} /> Sync
               </div>
            </div>
          </>
        ) : (
          // --- STATE: DISCONNECTED / AUTH ---
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500 relative overflow-hidden">
             
             {/* Authentication Overlay (Loading State) */}
             {isAuthenticating && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <Loader2 size={32} className="text-[#5F2427] animate-spin mb-4" />
                    <h4 className="text-[15px] font-semibold text-gray-900">{authStatus}</h4>
                    <p className="text-[12px] text-gray-400 mt-2 px-6">Check the popup window to approve access.</p>
                </div>
             )}

             {/* Main Login UI */}
             <div className="w-16 h-16 rounded-full bg-[#FCCAE2] flex items-center justify-center mb-4 ring-1 ring-white shadow-sm">
                 <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" className="text-[#5F2427]">
                   <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.399.165-1.487-.695-2.419-2.875-2.419-4.629 0-3.773 2.749-7.253 7.951-7.253 4.173 0 7.41 2.967 7.41 6.923 0 4.133-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z"/>
                 </svg>
             </div>
             <h3 className="text-[18px] font-bold text-gray-900 mb-2">Inspiration awaits</h3>
             <p className="text-[13px] text-gray-500 leading-relaxed mb-6 px-4">
               Securely connect your Pinterest account to import boards and pins.
             </p>
             
             {authError && (
                 <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg text-[12px] font-medium text-left max-w-[280px]">
                     <AlertCircle size={16} className="shrink-0" />
                     <span>{authError}</span>
                 </div>
             )}

             <button 
               onClick={initiateOAuth}
               className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#5F2427] text-white font-semibold shadow-lg hover:bg-[#4a1c1e] active:scale-95 transition-all mb-4"
             >
               <LogIn size={16} />
               Secure Login via Pinterest
             </button>

             {/* Trust Signals */}
             <div className="flex items-center gap-4 text-[11px] text-gray-400">
                <div className="flex items-center gap-1">
                    <ShieldCheck size={12} className="text-[#3A5C34]" />
                    <span>Official Partner</span>
                </div>
                <div className="flex items-center gap-1">
                    <Lock size={12} />
                    <span>No credentials stored</span>
                </div>
             </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
};