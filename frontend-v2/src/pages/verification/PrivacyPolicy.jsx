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

const PrivacyPolicy = () => (
    <LegalLayout title="Privacy Policy" lastUpdated="21 February 2026">

        {/* Intro */}
        <section>
            <p className="text-[15px] leading-[1.8] text-[var(--color-gray-400)]">
                Hello and thank you for using <Highlight>Blinx AI Assistant</Highlight>. This application has been
                built as part of a <Highlight>college academic project</Highlight> and is not intended for
                any commercial use whatsoever. We genuinely respect your privacy and want to be upfront about
                what information we collect, why we collect it, and how we handle it.
            </p>
            <p className="text-[15px] leading-[1.8] text-[var(--color-gray-400)] mt-3">
                This Privacy Policy applies to all users who access Blinx AI Assistant via our
                website at <Highlight>blinxAI.me</Highlight> or any associated services.
            </p>
        </section>

        <Section icon="📋" title="Information We Collect">
            <p>
                To provide you a functional and seamless chat experience, we collect the following data
                when you sign up or use our services:
            </p>
            <ul className="list-none space-y-2.5 mt-2">
                {[
                    ['Full Name', 'To personalise your profile and display it to other users in conversations.'],
                    ['Email Address', 'For account creation, OTP-based login verification, and essential service-related communications.'],
                    ['Phone Number (optional)', 'If provided, used as an alternate method for OTP verification during login.'],
                    ['Google Account Information', 'When you choose "Sign in with Google", we receive your name, email, and profile picture from Google to set up your account quickly. We do not access your contacts, Drive, or any other Google data.'],
                    ['Chat Messages', 'Your text messages within conversations are stored on our servers so that you can access your chat history when you log back in.'],
                    ['Online/Presence Status', 'We track whether you are currently active so that other users can see your availability in real-time.'],
                    ['Basic Device Info', 'Browser type and screen size — solely to optimise the layout and responsiveness of the application.'],
                ].map(([label, desc], i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p><Highlight>{label}</Highlight> — {desc}</p>
                    </li>
                ))}
            </ul>
        </Section>

        <Section icon="🔐" title="Why We Need Google Account Access">
            <p>
                We understand that granting access to your Google account is a matter of trust. Here is
                exactly why we request it and what we do (and do not do) with it:
            </p>
            <div className="mt-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <ul className="space-y-3 text-[14px]">
                    <li className="flex items-start gap-2.5">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <p>We use Google OAuth <Highlight>solely for authentication</Highlight> — to verify your identity and let you sign in without remembering yet another password.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <p>We request <Highlight>email</Highlight> and <Highlight>calendar</Highlight> permissions from Google so you can use features like chat, account verification, and calendar integration. We do not access or store any other Google data.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-red-400 mt-0.5">✗</span>
                        <p>We <Highlight>never</Highlight> read your Gmail, Google Drive, Contacts, or any other Google service data except email and calendar (for integration features only).</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-red-400 mt-0.5">✗</span>
                        <p>We <Highlight>never</Highlight> post anything on your behalf or modify any Google account settings.</p>
                    </li>
                </ul>
            </div>
            <p className="mt-3">
                Being a college project, we have no business interest in your data. This access is
                purely functional — to make sign-in quick and hassle-free for you, and to enable calendar features if you wish to use them.
            </p>
        </Section>

        <Section icon="🎯" title="How We Use Your Information">
            <p>Your data is used strictly for the following purposes:</p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'To create and manage your user account on the platform.',
                    'To authenticate you securely via OTP or Google Sign-In.',
                    'To deliver core chat functionalities — sending/receiving messages, group chats, and real-time notifications.',
                    'To enable audio/video calling features (WebRTC) between users.',
                    'To power the AI assistant features like smart replies, conversation summaries, and task extraction.',
                    'To show your online/offline status to your contacts.',
                    'To improve the overall user experience and fix technical issues.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
        </Section>

        <Section icon="🛡️" title="Data Protection & Security">
            <p>
                We take reasonable measures to protect the information stored on our servers. These include:
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'All data transmitted between your browser and our servers is encrypted using HTTPS/TLS.',
                    'Authentication tokens are stored securely and expire after a set period.',
                    'Passwords are never stored in plain text — OTP-based verification eliminates the need for stored passwords altogether.',
                    'WebRTC calls are established via peer-to-peer connections, meaning call audio/video does not pass through our servers.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
            <p className="mt-3">
                However, as this is an academic project and not a production-grade enterprise system,
                we encourage you not to share any highly sensitive or confidential information through this platform.
            </p>
        </Section>

        <Section icon="🤝" title="Data Sharing">
            <p>
                We want to be absolutely clear:
            </p>
            <div className="mt-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <p className="text-[var(--color-gray-300)] font-medium text-[14px]">
                    We do not sell, rent, trade, or share your personal data with any third party for
                    commercial, advertising, or marketing purposes — period.
                </p>
            </div>
            <p className="mt-3">
                The only external service involved is <Highlight>Google OAuth</Highlight> for
                authentication. No other third-party service receives your data.
            </p>
        </Section>

        <Section icon="📦" title="Data Retention">
            <p>
                Your account data and chat history are retained on our servers for as long as your account
                remains active. Since this is a college project, the services and all stored data may be
                discontinued or deleted once the academic evaluation period concludes.
            </p>
            <p className="mt-2">
                You may request deletion of your data at any time by visiting our{' '}
                <a href="/data-deletion" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors font-medium">
                    Data Deletion
                </a>{' '}
                page or writing to us at the email address provided below.
            </p>
        </Section>

        <Section icon="⚖️" title="Your Rights">
            <p>
                As a user of Blinx AI Assistant, you have the right to:
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'Access the personal data we hold about you.',
                    'Request correction of any inaccurate information.',
                    'Request deletion of your account and all associated data.',
                    'Revoke Google account access at any time from your Google Account settings.',
                    'Withdraw your consent and stop using the platform at any point.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
        </Section>

        <Section icon="👶" title="Children's Privacy">
            <p>
                Blinx AI Assistant is designed for use by college students and is not intended for
                children under the age of 13. We do not knowingly collect information from minors.
                If we become aware that we have inadvertently collected data from a child, we shall
                promptly delete it.
            </p>
        </Section>

        <Section icon="🔄" title="Changes to This Policy">
            <p>
                We may update this Privacy Policy from time to time as the project evolves. Any changes
                will be reflected on this page with an updated "Last Updated" date. We encourage you to
                review this page periodically to stay informed.
            </p>
        </Section>

        <Section icon="📬" title="Contact Us">
            <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or your
                personal data, please do not hesitate to reach out:
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

export default PrivacyPolicy;
