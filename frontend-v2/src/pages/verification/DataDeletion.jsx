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

const DataDeletion = () => (
    <LegalLayout title="Data Deletion" lastUpdated="21 February 2026">

        {/* Intro */}
        <section>
            <p className="text-[15px] leading-[1.8] text-[var(--color-gray-400)]">
                At <Highlight>Blinx AI Assistant</Highlight>, we believe you should have full control
                over your personal data at all times. Since this is a <Highlight>college academic
                project</Highlight>, we have no reason to retain your data beyond what is needed to
                provide the service. If you wish to have your data removed, we are more than happy to
                assist.
            </p>
        </section>

        <Section icon="📋" title="What Data Do We Store?">
            <p>
                When you use Blinx AI Assistant, the following data is stored on our servers:
            </p>
            <ul className="list-none space-y-2.5 mt-2">
                {[
                    ['Account Information', 'Your name, email address, phone number (if provided), and profile picture.'],
                    ['Authentication Data', 'Login tokens and session identifiers used to keep you signed in securely.'],
                    ['Chat Messages', 'Text messages you have sent and received in direct and group conversations.'],
                    ['Group Memberships', 'Records of which chat groups you have created or joined.'],
                    ['AI Interaction Logs', 'Your conversations with the AI assistant feature.'],
                    ['Presence Data', 'Temporary records of your online/offline status (not permanently stored).'],
                ].map(([label, desc], i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p><Highlight>{label}</Highlight> — {desc}</p>
                    </li>
                ))}
            </ul>
            <p className="mt-3">
                We do <Highlight>not</Highlight> store any audio/video call recordings. Calls are
                established via peer-to-peer WebRTC connections and no call data passes through or
                is saved on our servers.
            </p>
        </Section>

        <Section icon="🗑️" title="How to Request Data Deletion">
            <p>
                You can request complete deletion of your data through any of the following methods:
            </p>

            {/* Method 1 */}
            <div className="mt-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <p className="text-[var(--color-gray-300)] font-semibold text-[14px] mb-2">
                    Method 1 — Send Us an Email
                </p>
                <p className="text-[14px]">
                    Write to us at{' '}
                    <a href="mailto:rk8210032@gmail.com" className="text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors font-medium">
                        rk8210032@gmail.com
                    </a>{' '}
                    with the subject line <Highlight>"Data Deletion Request"</Highlight>. Please include
                    the email address or phone number associated with your Blinx AI account so we can
                    locate and remove your data.
                </p>
            </div>

            {/* Method 2 */}
            <div className="mt-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <p className="text-[var(--color-gray-300)] font-semibold text-[14px] mb-2">
                    Method 2 — Revoke Google Access
                </p>
                <p className="text-[14px]">
                    If you signed in using Google, you can revoke Blinx AI Assistant's access from your
                    Google Account at any time:
                </p>
                <ol className="list-none space-y-1.5 mt-2 text-[14px]">
                    <li className="flex items-start gap-2.5">
                        <span className="text-blue-400 font-semibold mt-0.5 shrink-0">1.</span>
                        <p>
                            Go to your Google Account → Security →
                            <a
                                href="https://myaccount.google.com/security?pli=1#thirdpartyapps"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 underline underline-offset-4 hover:text-blue-300 transition-colors font-medium"
                            >
                                Third-party apps with account access
                            </a>.
                        </p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-blue-400 font-semibold mt-0.5 shrink-0">2.</span>
                        <p>Find "Blinx AI Assistant" in the list of connected applications.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-blue-400 font-semibold mt-0.5 shrink-0">3.</span>
                        <p>Click on it and select "Remove Access".</p>
                    </li>
                </ol>
                <p className="text-[14px] mt-2">
                    Once you revoke access, we will no longer be able to use your Google credentials.
                    To also delete the data already stored on our servers, please send us an email as
                    described above.
                </p>
            </div>

            {/* Method 3 (Recommended) */}
            <div className="mt-3 p-4 rounded-xl border border-blue-500/30 bg-[var(--color-background)]">
                <p className="text-blue-400 font-semibold text-[14px] mb-2">
                    Method 3 — Remove Access via Profile Settings <span className="ml-2 text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">Recommended</span>
                </p>
                <p className="text-[14px]">
                    For the easiest and fastest way, you can go to your <Highlight>Profile Settings</Highlight> inside Blinx AI Assistant and directly remove or revoke Google account access. This will disconnect your Google account and remove all associated permissions (including email and calendar). After revoking, you may also request full data deletion as described above.
                </p>
            </div>
        </Section>

        <Section icon="⏱️" title="Deletion Timeline">
            <p>
                Upon receiving your deletion request, we aim to process it as follows:
            </p>
            <ul className="list-none space-y-2 mt-2">
                {[
                    'Acknowledgement of your request — within 24 hours.',
                    'Complete deletion of your data from our active servers — within 7 working days.',
                    'Any cached or backup data (if applicable) — within 30 days.',
                ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                        <p>{item}</p>
                    </li>
                ))}
            </ul>
            <p className="mt-3">
                As this is an academic project with limited infrastructure, actual timelines may vary
                slightly, but we shall make every reasonable effort to honour these commitments.
            </p>
        </Section>

        <Section icon="📦" title="What Gets Deleted?">
            <p>
                When we process your deletion request, the following data will be permanently removed:
            </p>
            <div className="mt-3 grid gap-3">
                {[
                    { label: 'Account Profile', desc: 'Name, email, phone number, profile picture — all removed.', colour: 'bg-red-500/10 border-red-500/20 text-red-300' },
                    { label: 'Chat History', desc: 'All your direct messages and group messages — permanently erased.', colour: 'bg-red-500/10 border-red-500/20 text-red-300' },
                    { label: 'Group Memberships', desc: 'You will be removed from all groups. Groups you created will be reassigned or deleted.', colour: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
                    { label: 'AI Conversations', desc: 'All interactions with the AI assistant — cleared completely.', colour: 'bg-red-500/10 border-red-500/20 text-red-300' },
                    { label: 'Auth Tokens', desc: 'All active sessions and tokens — revoked and destroyed.', colour: 'bg-red-500/10 border-red-500/20 text-red-300' },
                ].map((item, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${item.colour} text-[14px]`}>
                        <p className="font-semibold">{item.label}</p>
                        <p className="mt-0.5 opacity-80">{item.desc}</p>
                    </div>
                ))}
            </div>
        </Section>

        <Section icon="ℹ️" title="Important Notes">
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
                <ul className="space-y-3 text-[14px]">
                    <li className="flex items-start gap-2.5">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <p>Data deletion is <Highlight>permanent and irreversible</Highlight>. Once your data has been deleted, it cannot be recovered.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <p>Messages you sent to other users in group chats may still be visible to them after deletion, but your identity will be anonymised or removed.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <p>If you created an account using Google Sign-In, revoking access from Google does not automatically delete your data from our servers — you must also submit a deletion request.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-amber-400 mt-0.5">!</span>
                        <p>Since this project may be discontinued after the academic evaluation, all remaining data will be deleted when the servers are decommissioned.</p>
                    </li>
                    <li className="flex items-start gap-2.5">
                        <span className="text-blue-400 mt-0.5">!</span>
                        <p>Blinx AI Assistant requests <Highlight>email</Highlight> and <Highlight>calendar</Highlight> permissions from Google only so you can use features like chat, account verification, and calendar integration. We do not access or store any other Google data, and you can revoke these permissions at any time.</p>
                    </li>
                </ul>
            </div>
        </Section>

        <Section icon="🔗" title="Related Policies">
            <p>
                For more information about how we handle your data, please refer to:
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
                <a
                    href="/privacy-policy"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-[14px] font-medium text-[var(--color-gray-300)] hover:text-blue-400 hover:border-blue-500/30 transition-all"
                >
                    <span>🔐</span> Privacy Policy
                </a>
                <a
                    href="/terms"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-[14px] font-medium text-[var(--color-gray-300)] hover:text-blue-400 hover:border-blue-500/30 transition-all"
                >
                    <span>📜</span> Terms of Service
                </a>
            </div>
        </Section>

        <Section icon="📬" title="Contact Us">
            <p>
                Have questions about data deletion or need assistance? We are here to help:
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

export default DataDeletion;
