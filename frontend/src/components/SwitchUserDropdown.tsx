import React, { useState, useEffect, useRef } from 'react';
import { Users, ChevronDown, UserCircle, Briefcase } from 'lucide-react';
import { switchRole } from '../apiService';

interface SwitchUserDropdownProps {
  currentRole: string;
  onRoleSwitch: (newRole: string, newToken: string, newUser: any) => void;
}

export const SwitchUserDropdown: React.FC<SwitchUserDropdownProps> = ({
  currentRole,
  onRoleSwitch
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roles = [
    { id: 'hr_admin', label: 'HR Admin', icon: Briefcase },
    { id: 'interviewer', label: 'Interviewer', icon: UserCircle }
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'u') {
        event.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSwitch = async (role: string) => {
    if (role === currentRole) { setIsOpen(false); return; }
    setLoading(true);
    try {
      const { token, role: newRole, user } = await switchRole(role);
      onRoleSwitch(newRole, token, user);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch role:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentRoleInfo = roles.find(r => r.id === currentRole);

  return (
    <div className="relative" ref={dropdownRef} data-testid="switch-user-dropdown">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f4f4f5] hover:bg-[#e4e4e7] transition-colors border border-[#e4e4e7] text-sm font-medium text-[#374151]"
        disabled={loading}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Users className="w-3.5 h-3.5 text-[#71717a]" />
        <span>{currentRoleInfo?.label || currentRole}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#71717a] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white border border-[#e4e4e7] shadow-lg z-50 overflow-hidden">
          <div className="p-1.5">
            <p className="text-[10px] text-[#a1a1aa] px-2.5 py-1.5 uppercase tracking-wider font-medium">Switch View</p>
            {roles.map((role) => {
              const Icon = role.icon;
              const isActive = role.id === currentRole;
              return (
                <button
                  key={role.id}
                  onClick={() => handleSwitch(role.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-sm ${
                    isActive
                      ? 'bg-[#eff6ff] text-[#0070f3] font-medium'
                      : 'text-[#374151] hover:bg-[#f4f4f5]'
                  }`}
                  disabled={loading}
                  data-testid={`switch-to-${role.id.replace('_', '-')}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#0070f3]' : 'text-[#71717a]'}`} />
                  <span>{role.label}</span>
                  {isActive && (
                    <span className="ml-auto text-[10px] bg-[#eff6ff] text-[#0070f3] px-1.5 py-0.5 rounded-full border border-[#0070f3]/20">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[#f4f4f5] px-3 py-2">
            <div className="text-[10px] text-[#a1a1aa] flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[#f4f4f5] rounded text-[#71717a] font-mono text-[10px]">⌘</kbd>
              <span>+</span>
              <kbd className="px-1 py-0.5 bg-[#f4f4f5] rounded text-[#71717a] font-mono text-[10px]">⇧</kbd>
              <span>+</span>
              <kbd className="px-1 py-0.5 bg-[#f4f4f5] rounded text-[#71717a] font-mono text-[10px]">U</kbd>
              <span className="ml-1">to toggle</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
