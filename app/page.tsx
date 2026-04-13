"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const HomePage = () => {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleGetStarted = () => {
    setIsNavigating(true);
    if (userId) {
      router.push("/projects");
    } else {
      router.push("/sign-in");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a] p-6 sm:p-8 py-16">
      <div className="max-w-2xl mx-auto text-center">
        {/* Title */}
        <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white">
          KnowledgeDock
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-300 mb-12 leading-relaxed">
          Build intelligent Q&A systems with your own knowledge base. Upload
          documents, ingest URLs, and get instant answers powered by{" "}
          <span className="font-semibold text-gray-200">
            advanced retrieval augmented generation
          </span>
          .
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-lg bg-[#252525] border border-gray-700 hover:border-gray-600 transition-colors">
            <div className="mb-3">
              <svg
                className="w-8 h-8 mx-auto text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-white mb-2">
              Multi-Format Support
            </h3>
            <p className="text-sm text-gray-400">
              Upload PDFs, DOCX, PPTX, Markdown, TXT, and live URLs
            </p>
          </div>

          <div className="p-6 rounded-lg bg-[#252525] border border-gray-700 hover:border-gray-600 transition-colors">
            <div className="mb-3">
              <svg
                className="w-8 h-8 mx-auto text-purple-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-white mb-2">Fast Retrieval</h3>
            <p className="text-sm text-gray-400">
              Vector + keyword search with smart reranking
            </p>
          </div>

          <div className="p-6 rounded-lg bg-[#252525] border border-gray-700 hover:border-gray-600 transition-colors">
            <div className="mb-3">
              <svg
                className="w-8 h-8 mx-auto text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-white mb-2">Tunable Settings</h3>
            <p className="text-sm text-gray-400">
              Fine-tune retrieval strategy per project
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleGetStarted}
          disabled={!isLoaded || isNavigating}
          className="inline-flex items-center gap-2 px-8 py-3 bg-[#252525] hover:bg-[#2a2a2a] border border-gray-600 hover:border-gray-500 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isNavigating ? (
            <>
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Redirecting...
            </>
          ) : (
            <>
              Get Started
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default HomePage;
