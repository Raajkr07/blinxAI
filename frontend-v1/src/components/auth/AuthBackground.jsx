import AuthBackgroundSvg from '../../assets/auth-background.svg';

export default function AuthBackground() {
    return (
        <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden"
        >
            {/* Soft gradient glow blobs */}
            <div className="absolute -top-[10%] -left-[10%] w-[60vw] max-w-150 aspect-square bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
            <div
                className="absolute -bottom-[10%] -right-[10%] w-[60vw] max-w-150 aspect-square bg-purple-600/20 rounded-full blur-[120px] animate-pulse"
                style={{ animationDelay: '1s' }}
            />

            {/* Lightning bolts */}
            <div
                className="lightning-bolt top-[20%] left-[15%] h-[35vh] rotate-15"
                style={{ animationDelay: '3s' }}
            />
            <div
                className="lightning-bolt top-[60%] right-[20%] h-[25vh] -rotate-15"
                style={{ animationDelay: '1.5s' }}
            />
            <div
                className="lightning-bolt top-[10%] right-[30%] h-[20vh] rotate-45"
                style={{ animationDelay: '4s' }}
            />

            <img
                src={AuthBackgroundSvg}
                alt=""
                loading="lazy"
                decoding="async"
                className="
          absolute inset-0
          w-full h-full
          object-cover
          opacity-35
          mix-blend-overlay
          pointer-events-none
        "
            />
        </div>
    );
}
