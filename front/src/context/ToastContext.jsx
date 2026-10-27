import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

const ToastContext = createContext(null);

/**
 * Провайдер уведомлений.
 * const toast = useToast();
 * toast('Готово!', 'success' | 'danger' | 'warning' | 'info');
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message, variant = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => remove(id), 4500);
  }, [remove]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 2000 }}>
        {toasts.map((t) => (
          <Toast
            key={t.id}
            bg={t.variant}
            autohide
            delay={4200}
            onClose={() => remove(t.id)}
          >
            <Toast.Body className={t.variant === 'warning' ? 'text-dark' : 'text-white'}>
              {t.message}
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx?.show || (() => {});
}
