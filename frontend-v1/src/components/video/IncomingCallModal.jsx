import React from 'react';

export default function IncomingCallModal({
  call,
  callerName,
  callerAvatar,
  onAccept,
  onReject,
}) {
  return (
    <div className="fixed inset-0 z-2000 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-[slideUp_0.3s_ease-out]">
        {/* Caller avatar */}
        <div className="mb-6">
          {callerAvatar ? (
            <img
              src={callerAvatar}
              alt={callerName}
              className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-indigo-500"
            />
          ) : (
            <div className="w-32 h-32 rounded-full mx-auto bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-5xl text-white border-4 border-indigo-500">
              {callerName ? callerName[0].toUpperCase() : '?'}
            </div>
          )}
        </div>

        {/* Caller name */}
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
          {callerName || 'Unknown User'}
        </h3>

        {/* Call type */}
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          {call?.type === 'VIDEO' ? '📹 Incoming video call' : '📞 Incoming audio call'}
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-4">
          {/* Reject button */}
          <button
            type="button"
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition shadow-lg hover:scale-110"
            title="Reject call"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Accept button */}
          <button
            type="button"
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white transition shadow-lg hover:scale-110 animate-pulse"
            title="Accept call"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
