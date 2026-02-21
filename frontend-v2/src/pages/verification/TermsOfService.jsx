import { LegalLayout } from '../../components/layout';

const Section = ({ icon, title, children }) => (
    <section>
        <h2 className="flex items-center gap-3 text-xl font-bold text-[var(--color-foreground)] mb-4 tracking-tight">
            <span className="text-lg">{icon}</span>
            {title}
        </h2>
        <div className="pl-1 space-y-3 text-[15px] leading-[1.8] text-[var(--color-gray-400)]">
            {children}
        </div>
    </section>
);

const Highlight = ({ children }) => (
    <span className="text-[var(--color-gray-300)] font-medium">{children}</span>
);

const TermsOfService = () => (
    <LegalLayout title="Terms of Service" lastUpdated="21 February 2026">

        {/* Intro */}
        <section>
            <p className="text-[15px] leading-[1.8] text-[var(--color-gray-400)]">
                Welcome to <Highlight>Blinx AI Assistant</Highlight>. Please read these Terms of Service
                carefully before using the application. By accessing or using Blinx AI Assistant, you
                agree to be bound by these terms. If you do not agree, kindly refrain from using the service.
            </p>
            <p className="text-[15px] leading-[1.8] text-[var(--color-gray-400)] mt-3">
                Blinx AI Assistant is a <Highlight>college academic project</Highlight> developed for
                educational and demonstration purposes. It is not a commercial product and is not operated
                for profit in any manner.
            </p>
        </section>

        <Section icon="📖" title="About the Service">
            <p>
                Blinx AI Assistant is a real-time web-based chat application built as part of an
                academic curriculum. The platform offers the following features:
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'One-to-one and group text messaging with real-time delivery.',
                    'Audio and video calling powered by WebRTC (peer-to-peer).',
                    'AI-powered features such as smart reply suggestions, conversation summarisation, and task extraction.',
                    'User presence indicators (online/offline status).',
                    'Secure authentication via OTP verification or Google Sign-In.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
        </Section>

        <Section icon="✅" title="Eligibility">
            <p>
                By using Blinx AI Assistant, you confirm that:
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'You are at least 13 years of age.',
                    'You are capable of entering into a legally binding agreement.',
                    'You will provide accurate and truthful information when creating your account.',
                    'You understand that this is an academic project and not a commercially operated service.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
        </Section>

        <Section icon="👤" title="User Accounts">
            <p>
                To access the features of Blinx AI Assistant, you need to create an account using either
                your email/phone number with OTP verification, or via Google Sign-In.
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'You are responsible for maintaining the confidentiality of your account credentials and login sessions.',
                    'You are responsible for all activities that occur under your account.',
                    'You must notify us promptly if you suspect any unauthorised use of your account.',
                    'We reserve the right to suspend or remove accounts that violate these terms.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
        </Section>

        <Section icon="🚫" title="Acceptable Use">
            <p>
                Whilst using Blinx AI Assistant, you agree <Highlight>not to</Highlight>:
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'Send messages that are abusive, threatening, hateful, obscene, or otherwise objectionable.',
                    'Impersonate another person or misrepresent your identity.',
                    'Attempt to gain unauthorised access to other user accounts or the underlying systems.',
                    'Upload or share malware, viruses, or any harmful code or files.',
                    'Use the platform for spamming, phishing, or any form of fraud.',
                    'Exploit the AI features to generate harmful, misleading, or inappropriate content.',
                    'Use automated bots, scrapers, or similar tools to interact with the service without explicit permission.',
                    'Interfere with or disrupt the normal functioning of the application or its infrastructure.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
            <p className="mt-3">
                Violation of these guidelines may result in immediate suspension or permanent removal
                of your account without prior notice.
            </p>
        </Section>

        <Section icon="💬" title="Content & Messages">
            <p>
                You retain ownership of the messages and content you share on Blinx AI Assistant.
                However, by using the service, you grant us a limited, non-exclusive licence to store
                and transmit your content solely for the purpose of delivering the chat functionality.
            </p>
            <p className="mt-2">
                We do not actively monitor or review the content of private conversations. However, we
                reserve the right to remove content that is reported or found to be in violation of these
                terms.
            </p>
        </Section>

        <Section icon="🤖" title="AI Features">
            <p>
                The AI-powered features within Blinx AI Assistant (such as smart replies, summaries,
                and task extraction) are provided on an <Highlight>"as-is" basis</Highlight>. These
                features are experimental and developed for academic demonstration.
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'AI-generated responses may not always be accurate, relevant, or appropriate.',
                    'You should not rely on AI suggestions for critical or sensitive decision-making.',
                    'We are not liable for any consequences arising from the use of AI-generated content.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
        </Section>

        <Section icon="📞" title="Audio & Video Calls">
            <p>
                The calling feature uses WebRTC technology for peer-to-peer connections between users.
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'Call quality depends on your internet connection and device capabilities.',
                    'Call audio and video data travels directly between users and does not pass through our servers.',
                    'We do not record or store any call data.',
                    'You are responsible for ensuring you have consent from the other party before initiating a call.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
        </Section>

        <Section icon="🔒" title="Privacy">
            <p>
                Your use of Blinx AI Assistant is also governed by our{' '}
                <a href="/privacy-policy" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors font-medium">
                    Privacy Policy
                </a>, which explains how we collect, use, and protect your personal information.
                Please review it carefully.
            </p>
        </Section>

        <Section icon="⚠️" title="Disclaimers">
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <ul className="space-y-3 text-[14px]">
                    <li className="flex items-start gap-2.5">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <p>Blinx AI Assistant is provided <Highlight>"as is"</Highlight> and <Highlight>"as available"</Highlight> without any warranties of any kind, whether express or implied.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <p>As a college project, we do not guarantee uninterrupted, secure, or error-free operation of the service.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <p>The service may be taken offline, modified, or discontinued at any time without prior notice, particularly after the academic evaluation period.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <p>We shall not be held liable for any direct, indirect, incidental, or consequential damages arising from your use of the application.</p>
                    </li>
                </ul>
            </div>
        </Section>

        <Section icon="🏛️" title="Intellectual Property">
            <p>
                The design, code, branding, and all associated materials of Blinx AI Assistant are the
                intellectual property of the project developer(s). You may not copy, reproduce,
                distribute, or create derivative works from any part of this application without
                explicit written consent.
            </p>
        </Section>

        <Section icon="📝" title="Modifications to Terms">
            <p>
                We reserve the right to modify these Terms of Service at any time. Changes will be
                posted on this page with the updated "Last Updated" date. Continued use of the
                application after any modifications constitutes your acceptance of the revised terms.
            </p>
        </Section>

        <Section icon="⚖️" title="Governing Law">
            <p>
                These Terms of Service shall be governed by and construed in accordance with the laws
                of <Highlight>India</Highlight>. Any disputes arising from these terms shall be subject
                to the exclusive jurisdiction of the courts in India.
            </p>
        </Section>

        <Section icon="📬" title="Contact Us">
            <p>
                If you have any questions or concerns regarding these Terms of Service, we are happy
                to help. Reach out to us at:
            </p>
            <div className="mt-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <p className="text-[14px]">
                    <Highlight>Project</Highlight> — Blinx AI Assistant (College Academic Project)
                </p>
                <p className="text-[14px] mt-1">
                    <Highlight>Email</Highlight> —{' '}
                    <a href="mailto:rk8210032@gmail.com" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors">
                        rk8210032@gmail.com
                    </a>
                </p>
                <p className="text-[14px] mt-1">
                    <Highlight>Website</Highlight> —{' '}
                    <a href="https://blinxAI.me" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors">
                        blinxAI.me
                    </a>
                </p>
            </div>
        </Section>

    </LegalLayout>
);

export default TermsOfService;
