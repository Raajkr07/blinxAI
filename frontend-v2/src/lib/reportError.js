import toast from 'react-hot-toast';

const shown = new Set();

export function clearReportedError(id) {
    shown.delete(id);
    toast.dismiss(id);
}

export function reportErrorOnce(id, error, message) {
    void error;

    if (shown.has(id)) return;
    shown.add(id);

    toast.error(message, { id });
}

export function reportError(error, message) {
    void error;
    toast.error(message);
}
