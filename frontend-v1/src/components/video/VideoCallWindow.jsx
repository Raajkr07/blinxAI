import React from 'react';

export default function VideoCallWindow({
  localVideoRef,
  remoteVideoRef,
  isMuted,
  isVideoEnabled,
  callStatus,
  currentCall,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  callerName,
}) {
  return (
    <div className="fixed inset-0 z-[2000] bg-black flex flex-col">
      {/* Remote video (main view) */}
      <div className="flex-1 relative bg-neutral-900">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Call status overlay */}
        {callStatus === 'ringing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <div className="mb-4 text-6xl animate-pulse">📞</div>
              <p className="text-xl font-semibold">Calling {callerName || 'User'}...</p>
              <p className="text-sm text-neutral-300 mt-2">Waiting for answer</p>
            </div>
          </div>
        )}

        {callStatus === 'calling' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <div className="mb-4 text-6xl animate-pulse">📞</div>
              <p className="text-xl font-semibold">Connecting...</p>
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div className="absolute top-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-neutral-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-800">
              <div className="text-white text-4xl">📷</div>
            </div>
          )}
        </div>

        {/* Call info */}
        <div className="absolute top-4 left-4 bg-black/50 rounded-lg px-4 py-2 text-white">
          <p className="text-sm font-semibold">{callerName || 'User'}</p>
          <p className="text-xs text-neutral-300">
            {currentCall?.type === 'VIDEO' ? 'Video Call' : 'Audio Call'}
          </p>
        </div>
      </div>

      {/* Call controls */}
      <div className="bg-black/80 px-6 py-4 flex items-center justify-center gap-4">
        {/* Mute button */}
        <button
          type="button"
          onClick={onToggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
            isMuted
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-neutral-700 hover:bg-neutral-600'
          } text-white`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* Video toggle button */}
        {currentCall?.type === 'VIDEO' && (
          <button
            type="button"
            onClick={onToggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              isVideoEnabled
                ? 'bg-neutral-700 hover:bg-neutral-600'
                : 'bg-red-600 hover:bg-red-700'
            } text-white`}
            title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
          >
            {isVideoEnabled ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>
        )}

        {/* End call button */}
        <button
          type="button"
          onClick={onEndCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition"
          title="End call"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M16 8l2 2m0 0l2-2m-2 2l-2 2M8 16l-2-2m0 0l-2 2m2-2l2 2m-2-2l-2-2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
