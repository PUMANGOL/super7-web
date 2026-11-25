import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BackofficeRoute, RequirePermission } from './components/auth/BackofficeRoute';
import { MetaPixelTracker } from './components/MetaPixelTracker';
import { IconSprite } from './components/store/Icon';
import { StoreLayout } from './components/store/StoreLayout';
import { AuthProvider } from './context/AuthProvider';
import { CartProvider } from './context/CartProvider';
import { ToastProvider } from './context/ToastProvider';
import { LoginPage } from './pages/LoginPage';
import { CartPage } from './pages/store/CartPage';
import { CatalogPage } from './pages/store/CatalogPage';
import { CheckoutPage } from './pages/store/CheckoutPage';
import { HomePage } from './pages/store/HomePage';
import { LegacyConfirmationRedirect, NotFoundPage } from './pages/store/NotFoundPage';
import { OrderPage } from './pages/store/OrderPage';
import { ProductPage } from './pages/store/ProductPage';

/* O back-office é carregado à parte: os clientes da loja não descarregam este código. */
const BackofficeLayout = lazy(() =>
  import('./components/backoffice/BackofficeLayout').then((module) => ({ default: module.BackofficeLayout })),
);
const BackofficeOrdersPage = lazy(() =>
  import('./pages/backoffice/BackofficeOrdersPage').then((module) => ({ default: module.BackofficeOrdersPage })),
);
const BackofficeOrderDetailPage = lazy(() =>
  import('./pages/backoffice/BackofficeOrderDetailPage').then((module) => ({ default: module.BackofficeOrderDetailPage })),
);
const BackofficeProductsPage = lazy(() =>
  import('./pages/backoffice/BackofficeProductsPage').then((module) => ({ default: module.BackofficeProductsPage })),
);
const BackofficeProductFormPage = lazy(() =>
  import('./pages/backoffice/BackofficeProductFormPage').then((module) => ({ default: module.BackofficeProductFormPage })),
);
const BackofficeBooksPage = lazy(() =>
  import('./pages/backoffice/BackofficeBooksPage').then((module) => ({ default: module.BackofficeBooksPage })),
);
const BackofficeAddBookPage = lazy(() =>
  import('./pages/backoffice/BackofficeAddBookPage').then((module) => ({ default: module.BackofficeAddBookPage })),
);
const BackofficeCategoriesPage = lazy(() =>
  import('./pages/backoffice/BackofficeCategoriesPage').then((module) => ({ default: module.BackofficeCategoriesPage })),
);
const BackofficePickupPostsPage = lazy(() =>
  import('./pages/backoffice/BackofficePickupPostsPage').then((module) => ({ default: module.BackofficePickupPostsPage })),
);
const BackofficeDashboardPage = lazy(() =>
  import('./pages/backoffice/BackofficeDashboardPage').then((module) => ({ default: module.BackofficeDashboardPage })),
);
const BackofficeSettingsPage = lazy(() =>
  import('./pages/backoffice/BackofficeSettingsPage').then((module) => ({ default: module.BackofficeSettingsPage })),
);
const BackofficeAppearancePage = lazy(() =>
  import('./pages/backoffice/BackofficeAppearancePage').then((module) => ({ default: module.BackofficeAppearancePage })),
);
const BackofficeUsersPage = lazy(() =>
  import('./pages/backoffice/BackofficeUsersPage').then((module) => ({ default: module.BackofficeUsersPage })),
);
const BackofficePermissionsPage = lazy(() =>
  import('./pages/backoffice/BackofficePermissionsPage').then((module) => ({ default: module.BackofficePermissionsPage })),
);

function BackofficeLoading() {
  return (
    <div className="auth-loading">
      <p>A carregar o back-office…</p>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <IconSprite />
            <MetaPixelTracker />
            <Routes>
              <Route path="login" element={<LoginPage />} />
              <Route path="cadastro" element={<Navigate to="/login" replace />} />

              <Route
                path="backoffice"
                element={
                  <BackofficeRoute>
                    <Suspense fallback={<BackofficeLoading />}>
                      <BackofficeLayout />
                    </Suspense>
                  </BackofficeRoute>
                }
              >
                <Route index element={<Navigate to="painel" replace />} />
                <Route
                  path="painel"
                  element={
                    <RequirePermission permission="viewDashboard">
                      <BackofficeDashboardPage />
                    </RequirePermission>
                  }
                />
                <Route path="encomendas" element={<BackofficeOrdersPage />} />
                <Route path="encomendas/:id" element={<BackofficeOrderDetailPage />} />
                <Route
                  path="produtos"
                  element={
                    <RequirePermission permission="manageCatalog">
                      <BackofficeProductsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="produtos/novo"
                  element={
                    <RequirePermission permission="manageCatalog">
                      <BackofficeProductFormPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="produtos/:id"
                  element={
                    <RequirePermission permission="manageCatalog">
                      <BackofficeProductFormPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="livros"
                  element={
                    <RequirePermission permission="manageCatalog">
                      <BackofficeBooksPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="livros/novo"
                  element={
                    <RequirePermission permission="manageCatalog">
                      <BackofficeAddBookPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="categorias"
                  element={
                    <RequirePermission permission="manageCatalog">
                      <BackofficeCategoriesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="postos"
                  element={
                    <RequirePermission permission="manageCatalog">
                      <BackofficePickupPostsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="definicoes"
                  element={
                    <RequirePermission permission="viewSettings">
                      <BackofficeSettingsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="aparencia"
                  element={
                    <RequirePermission permission="manageSettings">
                      <BackofficeAppearancePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="utilizadores"
                  element={
                    <RequirePermission permission="manageUsers">
                      <BackofficeUsersPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="permissoes"
                  element={
                    <RequirePermission permission="manageUsers">
                      <BackofficePermissionsPage />
                    </RequirePermission>
                  }
                />
              </Route>

              <Route element={<StoreLayout />}>
                <Route index element={<HomePage />} />
                <Route path="catalogo" element={<CatalogPage />} />
                <Route path="produto/:id" element={<ProductPage />} />
                <Route path="carrinho" element={<CartPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="encomenda" element={<OrderPage />} />
                {/* Link enviado nos e-mails da API (app.order.tracking-url). */}
                <Route path="encomenda/:id" element={<OrderPage />} />
                <Route path="confirmacao/:orderId" element={<LegacyConfirmationRedirect />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
