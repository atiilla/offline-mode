import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              🚀 Next.js Job Queue PWA
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Simple & Fast in-memory job processing sistemi
            </p>
            <div className="flex justify-center space-x-4 text-sm text-gray-500">
              <span className="bg-white px-3 py-1 rounded-full">Next.js 15</span>
              <span className="bg-white px-3 py-1 rounded-full">TypeScript</span>
              <span className="bg-white px-3 py-1 rounded-full">Memory Queue</span>
              <span className="bg-white px-3 py-1 rounded-full">PWA</span>
              <span className="bg-white px-3 py-1 rounded-full">Tailwind CSS</span>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-4">📝</div>
              <h3 className="text-lg font-semibold mb-2">Form Submission</h3>
              <p className="text-gray-600 text-sm">
                Kullanıcı formu doldurur ve background&apos;da işlenir
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-4">🧠</div>
              <h3 className="text-lg font-semibold mb-2">Memory Queue</h3>
              <p className="text-gray-600 text-sm">
                Redis gerektirmez, basit ve hızlı işlem
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="text-3xl mb-4">📱</div>
              <h3 className="text-lg font-semibold mb-2">PWA Ready</h3>
              <p className="text-gray-600 text-sm">
                Progressive Web App desteği
              </p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center mb-16">
            <Link
              href="/submit"
              className="bg-green-600 text-white px-12 py-4 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg text-lg"
            >
              📝 Job Queue Test Et
            </Link>
          </div>

     
        </div>
      </div>
    </div>
  );
}
