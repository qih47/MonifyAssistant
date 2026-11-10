import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchAppSettings, saveAppSettings } from '../config/api';
import type { AppSettings } from '../config/api';

interface FamilyContextType {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;
  householdName: string;
  partnerEnabled: boolean;
  member1: AppSettings['member_1'];
  member2: AppSettings['member_2'];
  activeChatActor: 'member_1' | 'member_2';
  setActiveChatActor: (actor: 'member_1' | 'member_2') => void;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  reloadSettings: () => Promise<void>;
  getActorLabel: (actorKey: string) => { name: string; role: string; color: string; badge: string };
}

const defaultMember1 = {
  id: 'member_1',
  name: 'Ayah',
  role: 'Suami',
  color: 'emerald'
};

const defaultMember2 = {
  id: 'member_2',
  name: 'Ibu',
  role: 'Istri',
  color: 'violet'
};

const defaultSettings: AppSettings = {
  household_name: 'Keluarga Bahagia',
  currency: 'IDR',
  low_fund_threshold: 100000,
  partner_enabled: false,
  member_1: defaultMember1,
  member_2: defaultMember2,
  telegram_config: { enabled: false }
};

const FamilyContext = createContext<FamilyContextType>({
  settings: defaultSettings,
  isLoading: false,
  error: null,
  householdName: 'Keluarga Bahagia',
  partnerEnabled: false,
  member1: defaultMember1,
  member2: defaultMember2,
  activeChatActor: 'member_1',
  setActiveChatActor: () => {},
  updateSettings: async () => {},
  reloadSettings: async () => {},
  getActorLabel: () => ({ name: 'Member', role: 'Partner', color: 'emerald', badge: '🧑' })
});

export const FamilyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChatActor, setActiveChatActor] = useState<'member_1' | 'member_2'>('member_1');

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchAppSettings();
      setSettings(data);
    } catch (err: any) {
      console.warn('⚠️ Gagal memuat settings dari server, memakai fallback:', err);
      setError(err.message || 'Gagal memuat');
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleUpdate = async (updates: Partial<AppSettings>) => {
    const updated = await saveAppSettings(updates);
    setSettings(updated);
  };

  const currentSettings = settings || defaultSettings;
  const partnerEnabled = !!currentSettings.partner_enabled;
  const member1 = currentSettings.member_1 || defaultMember1;
  const member2 = currentSettings.member_2 || defaultMember2;
  const householdName = currentSettings.household_name || 'Keluarga Bahagia';

  const getActorLabel = (actorKey: string) => {
    const lower = (actorKey || '').toLowerCase();
    if (lower === 'suami' || lower === 'member_1' || lower === member1.name.toLowerCase() || lower === member1.role.toLowerCase()) {
      return {
        name: member1.name,
        role: member1.role,
        color: member1.color || 'emerald',
        badge: '🧑'
      };
    }
    if (partnerEnabled && (lower === 'istri' || lower === 'member_2' || lower === member2.name.toLowerCase() || lower === member2.role.toLowerCase())) {
      return {
        name: member2.name,
        role: member2.role,
        color: member2.color || 'violet',
        badge: '👩'
      };
    }
    return {
      name: actorKey || (partnerEnabled ? 'Bersama' : member1.name),
      role: 'Keluarga',
      color: 'slate',
      badge: '👥'
    };
  };

  return (
    <FamilyContext.Provider
      value={{
        settings: currentSettings,
        isLoading,
        error,
        householdName,
        partnerEnabled,
        member1,
        member2,
        activeChatActor: partnerEnabled ? activeChatActor : 'member_1',
        setActiveChatActor,
        updateSettings: handleUpdate,
        reloadSettings: loadSettings,
        getActorLabel
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
};

export const useFamily = () => useContext(FamilyContext);
