/**
 * NotFound - 404 catch-all page
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, Button } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header title="NOT FOUND" showBack />
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <Card className="max-w-sm w-full">
            <CardContent className="text-center">
              <p className="text-5xl mb-4">404</p>
              <h2 className="text-lg font-bold text-white mb-2">
                Page not found
              </h2>
              <p className="text-gray-400 mb-6">
                The page you're looking for doesn't exist or has been moved.
              </p>
              <Link to="/">
                <Button>Back to Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
