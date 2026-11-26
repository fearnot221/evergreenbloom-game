import { Link } from 'react-router-dom';
import { Page, useDocumentTitle } from '../components/page';
import { websiteHref } from '../data/deployment';
import { display } from '../data/display-copy';
import '../styles/pages.css';

export default function NotFoundPage() {
  useDocumentTitle('找不到頁面');
  return (
    <Page title={display.pages.notFound} className="not-found">
      <p className="actions">
        <Link className="button" to="/">
          回到集章冊
        </Link>
        <a className="button button-ghost" href={websiteHref()}>
          活動官網
        </a>
      </p>
    </Page>
  );
}
