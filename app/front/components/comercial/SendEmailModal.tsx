import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import { isEmail, isNotEmpty } from '../../utils/validation';

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { to: string; subject: string; body: string }) => void;
  to: string;
  subject: string;
  body: string;
}

interface Errors {
  [key: string]: string;
}

const SendEmailModal: React.FC<SendEmailModalProps> = ({
  isOpen,
  onClose,
  onSend,
  to: initialTo,
  subject: initialSubject,
  body: initialBody,
}) => {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [errors, setErrors] = useState<Errors>({});
  const [isSending, setIsSending] = useState(false);
  
  const validate = useCallback(() => {
    const newErrors: Errors = {};
    if (!isNotEmpty(to)) {
      newErrors.to = 'El destinatario es obligatorio.';
    } else if (!isEmail(to)) {
      newErrors.to = 'El formato del correo no es válido.';
    }
    if (!isNotEmpty(subject)) newErrors.subject = 'El asunto es obligatorio.';
    if (!isNotEmpty(body)) newErrors.body = 'El cuerpo del mensaje es obligatorio.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [to, subject, body]);

  useEffect(() => {
    validate();
  }, [to, subject, body, validate]);

  const handleSend = () => {
    if (!validate()) return;
    
    setIsSending(true);

    const instruction = "IMPORTANTE: Por favor, adjunte el documento PDF que se acaba de descargar en su carpeta de descargas.\n\n---\n\n";
    const finalBody = instruction + body;

    // Construir y abrir el enlace mailto:
    const subjectEncoded = encodeURIComponent(subject);
    const bodyEncoded = encodeURIComponent(finalBody);
    const mailtoLink = `mailto:${to}?subject=${subjectEncoded}&body=${bodyEncoded}`;
    window.location.href = mailtoLink;
    
    // Simular un pequeño retraso para la UX antes de cerrar el modal
    setTimeout(() => {
        onSend({ to, subject, body: finalBody });
        setIsSending(false);
    }, 700);
  };

  const getInputClasses = (fieldName: keyof Errors) => `w-full px-3 py-2 text-sm text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 ${
    errors[fieldName] ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
  }`;
  const labelClasses = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";
  const ErrorMessage: React.FC<{ fieldName: keyof Errors }> = ({ fieldName }) => (
    errors[fieldName] ? <p className="mt-1 text-xs text-red-500">{errors[fieldName]}</p> : null
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enviar Documento por Correo" size="2xl">
      <div className="space-y-4">
        <div>
          <label htmlFor="to" className={labelClasses}>Para:</label>
          <input
            id="to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={getInputClasses('to')}
          />
          <ErrorMessage fieldName="to" />
        </div>
        <div>
          <label htmlFor="subject" className={labelClasses}>Asunto:</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={getInputClasses('subject')}
          />
          <ErrorMessage fieldName="subject" />
        </div>
        <div>
          <label htmlFor="body" className={labelClasses}>Cuerpo del Mensaje:</label>
          <textarea
            id="body"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${getInputClasses('body')} min-h-[150px]`}
          />
          <ErrorMessage fieldName="body" />
        </div>
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || Object.keys(errors).length > 0}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {isSending ? (
                <><i className="fas fa-spinner fa-spin mr-2"></i>Abriendo...</>
            ) : (
                <><i className="fas fa-paper-plane mr-2"></i>Enviar</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SendEmailModal;
