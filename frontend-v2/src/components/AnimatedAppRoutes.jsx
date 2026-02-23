import { createElement } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Routes, Route } from 'react-router-dom';

const PageTransition = ({ children }) => (
  <Motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: 'easeInOut' }}
  >
    {children}
  </Motion.div>
);

export function AnimatedAppRoutes({ location, publicRoutes, protectedRoutes, NotFoundEl, ProtectedRoute }) {
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={location.pathname}>
        <Routes location={location}>
          {publicRoutes.map(({ path, element: Element }) => (
            <Route key={path} path={path} element={Element ? <Element /> : null} />
          ))}

          {protectedRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={createElement(ProtectedRoute, { element })} />
          ))}

          <Route path="*" element={createElement(NotFoundEl)} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
  );
}
