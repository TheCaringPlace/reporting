const navLinks = [
  { href: '#/', label: 'Home' },
  { href: '#/service-report', label: 'Service Report' },
  { href: '#/financials', label: 'Financial Report' },
  { href: '#/budget-tracker', label: 'Budget Tracker' },
  { href: '#/service-expenses', label: 'Expense per Household & Individual' },
];

const subtitles = {
  '/': 'Overview',
  '/service-report': 'Service Report',
  '/financials': 'Financial Report',
  '/budget-tracker': 'Budget Tracker',
  '/service-expenses': 'Expense per Household & Individual',
};

export function Layout({ children, path = '/' }) {
  const currentPath = path.replace(/\/$/, '') || '/';
  const subtitle = subtitles[currentPath] ?? 'Dashboard';

  return (
    <div class="app">
      <header>
        <a href="https://thecaringplace.info/" target="_blank" rel="noopener" class="logo-link">
          <img src="./logo.webp" alt="The Caring Place" class="logo" />
        </a>
        <div class="header-text">
          <h1>The Caring Place</h1>
          <p class="subtitle">{subtitle}</p>
        </div>
      </header>
      <nav>
        {navLinks.map((link) => {
          const linkPath = link.href === '#/' ? '/' : link.href.replace(/^#/, '');
          const isActive = currentPath === linkPath;
          return (
            <a href={link.href} class={isActive ? 'active' : ''}>
              {link.label}
            </a>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
