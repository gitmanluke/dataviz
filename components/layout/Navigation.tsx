"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Database, LayoutDashboard, Settings } from "lucide-react"

export function Navigation() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <LayoutDashboard className="w-8 h-8 text-blue-600" />
              <span className="font-semibold text-xl text-gray-900">DataViz</span>
            </Link>

            <div className="hidden sm:flex space-x-4">
              <Link
                href="/"
                className={`inline-flex items-center px-3 py-2 rounded-md ${
                  isActive("/") && pathname === "/"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Home className="w-4 h-4 mr-2" />
                Home
              </Link>

              <Link
                href="/data-sources"
                className={`inline-flex items-center px-3 py-2 rounded-md ${
                  isActive("/data-sources")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Database className="w-4 h-4 mr-2" />
                Data Sources
              </Link>

              <Link
                href="/settings"
                className={`inline-flex items-center px-3 py-2 rounded-md ${
                  isActive("/settings")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation
