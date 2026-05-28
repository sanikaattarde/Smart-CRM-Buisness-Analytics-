/**
 * Consistent content container for all page views.
 * Provides standardised padding and max-width so feature pages
 * don't each need to handle their own spacing.
 *
 * @param {{ children: React.ReactNode, className?: string }} props
 */
export default function PageWrapper({ children, className = '' }) {
  return (
    <main
      className={`
        flex-1 overflow-y-auto p-6 lg:p-8
        animate-fade-in
        ${className}
      `}
    >
      <div className="mx-auto max-w-[1440px]">
        {children}
      </div>
    </main>
  );
}
