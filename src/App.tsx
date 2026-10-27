import { AppCore } from './AppCore';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { DownloaderPage } from './pages/DownloaderPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { ArticlePage } from './pages/ArticlePage';
import { AboutPage } from './pages/AboutPage';
import { PromptBuilderPage } from './pages/PromptBuilderPage';
import { ToolsPage } from './pages/ToolsPage';
import { ToolInfoPage } from './pages/ToolInfoPage';
import { getArticles } from './ArticleDataServer';

const loadArticles = async (locale: string) => getArticles(locale) ?? getArticles('en')!;

export function App() {
  return <AppCore getArticles={getArticles} loadArticles={loadArticles} pages={{
    Header: SiteHeader,
    Footer: SiteFooter,
    downloader: DownloaderPage,
    promptBuilder: PromptBuilderPage,
    tools: ToolsPage,
    articles: ArticlesPage,
    about: AboutPage,
    article: ArticlePage,
    toolInfo: ToolInfoPage,
  }} />;
}
