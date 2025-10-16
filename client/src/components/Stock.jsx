import React, { useEffect, useState } from "react";

export default function Stock() {
    const [stock, setStock] = useState([]);

    useEffect(() => {
        fetch("http://localhost:5000/api/stock")
            .then((res) => res.json())
            .then((data) => setStock(data))
            .catch(console.error);
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Inventory & Stock</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
                <thead className="bg-blue-500 text-white">
                    <tr>
                        <th className="py-2 px-4">Item</th>
                        <th className="py-2 px-4">Central Stock</th>
                        <th className="py-2 px-4">Engineer Stock</th>
                    </tr>
                </thead>
                <tbody>
                    {stock.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-gray-100">
                            <td className="py-2 px-4">{s.name}</td>
                            <td className="py-2 px-4">{s.central}</td>
                            <td className="py-2 px-4">{s.engineer}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
