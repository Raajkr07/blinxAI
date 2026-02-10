import { cn } from '../../lib/utils';

export function AILogo({ className }) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(className)}
        >
            <rect
                x="3"
                y="2"
                width="9"
                height="7"
                rx="2"
                fill="currentColor"
            />
            <circle cx="6" cy="5.5" r="0.75" fill="black" />
            <circle cx="9" cy="5.5" r="0.75" fill="black" />
            <path
                d="M7.5 0.75V2"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
            />
            <circle cx="7.5" cy="0.75" r="0.75" fill="currentColor" />
            <path
                d="M2 13c0-2 2-3.5 5.5-3.5S13 11 13 13v1H2v-1z"
                fill="currentColor"
            />
        </svg>
    );
}
