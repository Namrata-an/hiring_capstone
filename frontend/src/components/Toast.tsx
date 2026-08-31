import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastProps {
    toast: ToastMessage;
    onClose: (id: string) => void;
}

function Toast({ toast, onClose }: ToastProps) {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => handleClose(), toast.duration || 5000);
        return () => clearTimeout(timer);
    }, [toast.id]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onClose(toast.id), 300);
    };

    const getStyles = () => {
        switch (toast.type) {
            case 'success': return {
                bg: 'bg-white border-emerald-200',
                icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
                title: 'text-emerald-800',
            };
            case 'error': return {
                bg: 'bg-white border-red-200',
                icon: <XCircle className="w-4 h-4 text-red-600" />,
                title: 'text-red-800',
            };
            case 'warning': return {
                bg: 'bg-white border-amber-200',
                icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
                title: 'text-amber-800',
            };
            case 'info': return {
                bg: 'bg-white border-[#0070f3]/30',
                icon: <Info className="w-4 h-4 text-[#0070f3]" />,
                title: 'text-[#0070f3]',
            };
        }
    };

    const styles = getStyles();

    return (
        <div className={`${styles.bg} border rounded-xl shadow-md p-4 min-w-[300px] max-w-sm transition-all duration-300 ease-out ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
            <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{styles.icon}</div>
                <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold ${styles.title} text-sm`}>{toast.title}</h4>
                    {toast.message && <p className="text-[#71717a] text-sm mt-0.5">{toast.message}</p>}
                </div>
                <button onClick={handleClose} className="shrink-0 p-1 hover:bg-[#f4f4f5] rounded-lg transition-colors">
                    <X className="w-3.5 h-3.5 text-[#a1a1aa]" />
                </button>
            </div>
        </div>
    );
}

interface ToastContainerProps {
    toasts: ToastMessage[];
    onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
    return (
        <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast toast={toast} onClose={onClose} />
                </div>
            ))}
        </div>
    );
}

export function useToast() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = (type: ToastType, title: string, message?: string, duration?: number) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev, { id, type, title, message, duration }]);
    };

    const closeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    return {
        toasts, showToast, closeToast,
        success: (title: string, message?: string, duration?: number) => showToast('success', title, message, duration),
        error: (title: string, message?: string, duration?: number) => showToast('error', title, message, duration),
        warning: (title: string, message?: string, duration?: number) => showToast('warning', title, message, duration),
        info: (title: string, message?: string, duration?: number) => showToast('info', title, message, duration),
    };
}
