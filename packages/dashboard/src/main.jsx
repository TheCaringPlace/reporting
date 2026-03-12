import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Router, Route } from 'preact-router';
import { createHashHistory } from 'history';
import { Layout } from './components/Layout.jsx';
import { lazyRoute } from './lib/lazyRoute.jsx';

// Ensure hash is set on initial load (e.g. visiting / with no hash → /#/)
if (!window.location.hash || window.location.hash === '#') {
  window.location.hash = '#/';
}

const fallback = <div class="loading">Loading…</div>;
const IndexPage = lazyRoute(() => import('./pages/IndexPage.jsx'), fallback);
const BudgetTrackerPage = lazyRoute(() => import('./pages/BudgetTrackerPage.jsx'), fallback);
const FinancialsPage = lazyRoute(() => import('./pages/FinancialsPage.jsx'), fallback);
const ServiceReportPage = lazyRoute(() => import('./pages/ServiceReportPage.jsx'), fallback);
const ServiceExpensesPage = lazyRoute(() => import('./pages/ServiceExpensesPage.jsx'), fallback);

function App() {
  const [path, setPath] = useState('/');
  const handleRoute = (e) => setPath(e.url);

  return (
    <Layout path={path}>
      <Router history={createHashHistory()} onChange={handleRoute}>
        <Route path="/" component={IndexPage} />
        <Route path="/budget-tracker" component={BudgetTrackerPage} />
        <Route path="/financials" component={FinancialsPage} />
        <Route path="/service-report" component={ServiceReportPage} />
        <Route path="/service-expenses" component={ServiceExpensesPage} />
      </Router>
    </Layout>
  );
}

render(<App />, document.getElementById('root'));
