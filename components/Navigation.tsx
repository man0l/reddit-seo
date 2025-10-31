import Link from 'next/link'

export default function Navigation() {
  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto px-6 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent hover:from-indigo-700 hover:to-purple-700 transition-all">
            Reddit SEO Tracker
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-slate-600 hover:text-indigo-600 transition-colors font-semibold px-4 py-2 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
            >
              Dashboard
            </Link>
            <Link
              href="/projects"
              className="text-slate-600 hover:text-indigo-600 transition-colors font-semibold px-4 py-2 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
            >
              Projects
            </Link>
            <Link
              href="/keywords"
              className="text-slate-600 hover:text-indigo-600 transition-colors font-semibold px-4 py-2 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
            >
              Keywords
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

