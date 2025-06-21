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
       
           
          </div>

      
          {/* Action Button */}
          <div className="flex justify-center mb-16">
            <Link
              href="/submit"
              className="bg-green-600 text-white px-12 py-4 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg text-lg"
            >
              📝 Test Form (Online/Offline mode)
            </Link>
          </div>

     
        </div>
      </div>
    </div>
  );
}
