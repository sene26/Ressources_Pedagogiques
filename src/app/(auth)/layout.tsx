export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-700">UASZ</p>
          <h1 className="text-2xl font-bold text-slate-900">RessourcesPéda</h1>
        </div>
        <div className="card">{children}</div>
      </div>
    </main>
  );
}
