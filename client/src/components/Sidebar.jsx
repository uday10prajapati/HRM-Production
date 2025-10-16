import React from "react";

export default function Sidebar({ modules, activeModule, setActiveModule }) {
    return (
        <div className="w-1/5 bg-blue-600 text-white p-6 flex flex-col space-y-4 min-h-screen">
            <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
            {modules.map((mod) => (
                <button
                    key={mod.key}
                    onClick={() => setActiveModule(mod.key)}
                    className={`w-full py-2 text-left px-2 rounded hover:bg-blue-500 ${activeModule === mod.key ? "bg-blue-700" : ""
                        }`}
                >
                    {mod.label}
                </button>
            ))}
        </div>
    );
}
