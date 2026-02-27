import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const EAssignCall = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Auto-populate from passed data
    const callData = location.state?.call || {};
    const isResolved = callData?.status?.toLowerCase() === 'resolved';

    // --- MODULE 1: Visit Entry State ---
    const [visitEntry, setVisitEntry] = useState(callData?.visit_entry || '');
    // Parsing potentially valid dates format (just mocked here for demo)
    const [appointmentDate, setAppointmentDate] = useState(callData?.appointment_date ? callData.appointment_date.split('T')[0] : '');
    const [startDate, setStartDate] = useState(callData?.visit_start_date ? callData.visit_start_date.split('T')[0] : '');
    const [endDate, setEndDate] = useState(callData?.visit_end_date ? callData.visit_end_date.split('T')[0] : '');

    let initialPlaces = [{ from: '', to: '', distance: '' }];
    if (callData?.places_visited) {
        try {
            initialPlaces = typeof callData.places_visited === 'string' ? JSON.parse(callData.places_visited) : callData.places_visited;
        } catch (e) {
            console.error("Failed to parse places", e);
        }
    }
    const [places, setPlaces] = useState(initialPlaces);

    const [returnHome, setReturnHome] = useState(callData?.return_to_home ? 'Yes' : 'No');

    let initReturnFrom = '';
    let initReturnTo = '';
    if (callData?.return_place) {
        try {
            const parsed = JSON.parse(callData.return_place);
            initReturnFrom = parsed.from || '';
            initReturnTo = parsed.to || '';
        } catch {
            initReturnFrom = callData.return_place;
        }
    }
    const [returnPlaceFrom, setReturnPlaceFrom] = useState(initReturnFrom);
    const [returnPlaceTo, setReturnPlaceTo] = useState(initReturnTo);
    const [returnKm, setReturnKm] = useState(callData?.return_km || '');

    // --- MODULE 2: Problem & Solution State ---
    const [problem1, setProblem1] = useState(callData?.problem || '');
    const [problem2, setProblem2] = useState(callData?.problem2 || '');
    const [solution, setSolution] = useState(callData?.solutions || '');

    // --- MODULE 3: Stock Entry State ---
    const [stocks, setStocks] = useState([]);
    const [itemType, setItemType] = useState(callData?.item_type || 'Auto Fetch Component');
    const [itemName, setItemName] = useState(callData?.part_used || '');
    const [quantity, setQuantity] = useState(callData?.quantity_used || 1);
    const [serialNumber, setSerialNumber] = useState(callData?.serial_number || '');
    const [remarks, setRemarks] = useState(callData?.remarks || '');
    const [underWarranty, setUnderWarranty] = useState(callData?.under_warranty || 'No');
    const [returnPartName, setReturnPartName] = useState(callData?.return_part_name || '');
    const [returnSerialNumber, setReturnSerialNumber] = useState(callData?.return_serial_number || '');

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            fetchEngineerStocks(parsedUser.id);
        }
    }, []);

    const fetchEngineerStocks = async (engineerId) => {
        try {
            const { data } = await axios.get(`/api/stock/engineer/${engineerId}`);
            setStocks(data);
        } catch (err) {
            console.error('Failed to fetch engineer stock:', err);
        }
    };

    // --- MODULE 4: Call Status & Attachment State ---
    const initialStatus = callData?.status?.toLowerCase() === 'new' ? 'pending' : (callData?.status?.toLowerCase() || 'pending');
    const [callStatus, setCallStatus] = useState(initialStatus);
    const [attachment, setAttachment] = useState(null);
    const [letterheadReceived, setLetterheadReceived] = useState(callData?.letterhead_received || false);

    // --- MODULE 5: TA Entry State ---
    const [voucherNumber, setVoucherNumber] = useState(callData?.voucher_number || 'VN-' + Math.floor(Math.random() * 10000));
    const [travelFromDate, setTravelFromDate] = useState(callData?.travel_from_date || '');
    const [travelToDate, setTravelToDate] = useState(callData?.travel_to_date || '');
    const [modeOfTravel, setModeOfTravel] = useState(callData?.mode_of_travel || '');
    const [travelType, setTravelType] = useState(callData?.travel_type || '');
    const [selectedCallId, setSelectedCallId] = useState(callData?.call_id || '');

    // Navigation state to control which section to show after save
    const [activeSection, setActiveSection] = useState('VISIT');

    // Make sections read-only if isResolved
    const readOnlyClasses = isResolved ? "opacity-90 pointer-events-none bg-gray-100" : "";

    // Handlers
    const handleAddPlace = () => {
        if (isResolved) return;
        setPlaces([...places, { from: '', to: '', distance: '' }]);
    };

    const handlePlaceChange = (index, field, value) => {
        if (isResolved) return;
        const newPlaces = [...places];
        newPlaces[index][field] = value;
        setPlaces(newPlaces);
    };

    const handleRemovePlace = (index) => {
        if (isResolved) return;
        const newPlaces = places.filter((_, i) => i !== index);
        setPlaces(newPlaces);
    };

    const handleCallIdSelect = (e) => {
        if (isResolved) return;
        const val = e.target.value;
        setSelectedCallId(val);
        if (val) {
            setVisitEntry('Auto-filled Visit Details for ' + val);
            toast.info('Visit details auto-filled based on Call ID!');
            setActiveSection('VISIT');
        }
    };

    const handleSaveVisitEntry = () => {
        if (isResolved) {
            setActiveSection('RESOLUTION');
            return;
        }
        for (let p of places) {
            if (!p.from || !p.to || !p.distance) {
                toast.error('All Place (From/To) and Distance (KM) fields are mandatory!');
                return;
            }
        }
        if (returnHome === 'Yes' && (!returnPlaceFrom || !returnPlaceTo || !returnKm)) {
            toast.error('Return Places (From/To) and Return KM are mandatory when Return Home is Yes!');
            return;
        }
        toast.success('Visit Entry Saved successfully!');
        setActiveSection('RESOLUTION');
    };

    const handleSaveProblemSolution = () => {
        if (isResolved) {
            setActiveSection('STOCK');
            return;
        }
        if (!problem1 || !solution) {
            toast.error('Problem 1 and Solution are mandatory!');
            return;
        }
        toast.success('Problem & Solution saved! Navigating to Stock Screen...');
        setActiveSection('STOCK');
    };

    const handleSaveStock = () => {
        if (isResolved) {
            setActiveSection('STATUS');
            return;
        }
        if (itemName && !serialNumber) {
            toast.error('Serial Number is mandatory if an item is selected!');
            return;
        }
        if (underWarranty === 'Yes') {
            if (!returnPartName || !returnSerialNumber) {
                toast.error('Old Part Name and Serial Number are mandatory for Warranty items!');
                return;
            }
        }
        toast.success('Stock Entry saved successfully!');
        setActiveSection('STATUS');
    };

    const handleSubmitStatus = async () => {
        if (isResolved) {
            toast.info('This call is already resolved!');
            navigate(-1);
            return;
        }
        if (!callStatus) {
            toast.error('Please select call status!');
            return;
        }

        try {
            const callId = callData?.call_id || callData?.id;

            let letterheadUrl = callData?.letterhead_url || null;

            if (!isResolved && attachment) {
                toast.info('Uploading attachment...');
                const formData = new FormData();
                formData.append('file', attachment);

                const uploadRes = await axios.post('/api/service-calls/upload-attachment', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (uploadRes.data.success) {
                    letterheadUrl = uploadRes.data.url;
                } else {
                    toast.error('Failed to upload attachment.');
                    return;
                }
            }

            // Calculate total km from places
            const totalKm = places.reduce((sum, p) => sum + (parseFloat(p.distance) || 0), 0);

            // Generate places string/JSON
            const placesJson = JSON.stringify(places);

            // Map Boolean for returnHome
            const isReturnHome = returnHome === 'Yes';

            const returnPlaceJson = (returnPlaceFrom || returnPlaceTo)
                ? JSON.stringify({ from: returnPlaceFrom, to: returnPlaceTo })
                : null;

            const payload = {
                status: callStatus,
                letterhead_received: letterheadReceived,
                letterhead_url: letterheadUrl,
                appointment_date: appointmentDate || null,
                visit_start_date: startDate || null,
                visit_end_date: endDate || null,
                places_visited: placesJson,
                kms_traveled: totalKm || null,
                return_to_home: isReturnHome,
                return_place: returnPlaceJson,
                return_km: returnKm ? parseFloat(returnKm) : null,
                problem1: problem1,
                problem2: problem2,
                solutions: solution,
                part_used: itemName,
                quantity_used: quantity ? parseInt(quantity) : null,
                serial_number: serialNumber,
                remarks: remarks,
                under_warranty: underWarranty,
                return_part_name: returnPartName,
                return_serial_number: returnSerialNumber
            };

            const res = await axios.put(`/api/service-calls/update-status/${callId}`, payload);

            if (res.data.success) {
                toast.success(`Call status updated to ${callStatus}!`);
                setTimeout(() => navigate(-1), 1500);
            } else {
                toast.error(res.data.message || 'Failed to update status.');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Network error. Failed to save.');
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
            <ToastContainer position="top-right" autoClose={3000} />

            {/* Topbar */}
            <div className="bg-[#2a8bf2] text-white flex items-center px-4 py-4 shadow-md sticky top-0 z-20">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold tracking-wide flex-1 text-center pr-10">
                    {isResolved ? 'Resolved Call Details' : 'Assign Call Details'}
                </h1>
            </div>

            {isResolved && (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 m-4 rounded shadow-sm text-sm font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This call has been marked as RESOLVED. Information is read-only.
                </div>
            )}

            {/* Content Area */}
            <div className={`flex-1 p-4 flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20 ${isResolved ? 'opacity-95' : ''}`}>


                {/* --- MODULE 1: VISIT ENTRY --- */}
                <div className={`bg-white rounded-2xl p-6 shadow-sm border ${activeSection === 'VISIT' ? 'border-[#2a8bf2] ring-2 ring-[#2a8bf2]/20' : 'border-gray-200'} transition-all`}>
                    <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setActiveSection('VISIT')}>
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</div>
                        <h2 className="text-xl font-bold text-gray-800">Visit Entry</h2>
                    </div>

                    {activeSection === 'VISIT' && (
                        <div className={`flex flex-col gap-5 animate-fadeIn ${readOnlyClasses}`}>
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Appointment Date</label>
                                    <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div className="flex flex-row gap-3">
                                    <div className="flex flex-col gap-1 flex-1">
                                        <label className="text-sm font-semibold text-gray-600">Start Date</label>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={isResolved} className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div className="flex flex-col gap-1 flex-1">
                                        <label className="text-sm font-semibold text-gray-600">End Date</label>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={isResolved} className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Distance Entries */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wider">Distance Tracking {!isResolved && <span className="text-red-500">*</span>}</h3>
                                <div className="flex flex-col gap-3">
                                    {places.map((place, index) => (
                                        <div key={index} className="flex flex-col gap-2 mb-2 pb-2 border-b border-gray-200 last:border-0 last:mb-0 last:pb-0">
                                            <div className="flex flex-row gap-3">
                                                <div className="flex-1">
                                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Place (From)</label>
                                                    <input type="text" value={place.from} onChange={e => handlePlaceChange(index, 'from', e.target.value)} disabled={isResolved} placeholder="From..." className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Place (To)</label>
                                                    <input type="text" value={place.to} onChange={e => handlePlaceChange(index, 'to', e.target.value)} disabled={isResolved} placeholder="To..." className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="flex flex-row gap-3 items-end">
                                                <div className="flex-1 w-full md:w-32 md:flex-none">
                                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Distance (KM)</label>
                                                    <input type="number" value={place.distance} onChange={e => handlePlaceChange(index, 'distance', e.target.value)} disabled={isResolved} placeholder="KM" className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                                </div>
                                                {!isResolved && places.length > 1 && (
                                                    <button onClick={() => handleRemovePlace(index)} className="p-2.5 px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {!isResolved && <button onClick={handleAddPlace} className="text-sm font-bold text-blue-600 bg-blue-50 py-2 rounded-lg hover:bg-blue-100 transition-colors mt-1 w-full md:w-auto md:self-start px-4">+ Add More Places</button>}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 bg-gray-50 p-4 rounded-xl border border-gray-200 mt-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Return Home</label>
                                    <select value={returnHome} onChange={e => setReturnHome(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-1/3">
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </div>
                                {returnHome === 'Yes' && (
                                    <div className="flex flex-col gap-2 pt-2 border-t border-gray-200 border-dashed mt-2">
                                        <div className="flex flex-row gap-3">
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Place (From)</label>
                                                <input type="text" value={returnPlaceFrom} onChange={e => setReturnPlaceFrom(e.target.value)} disabled={isResolved} placeholder="From..." className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Place (To)</label>
                                                <input type="text" value={returnPlaceTo} onChange={e => setReturnPlaceTo(e.target.value)} disabled={isResolved} placeholder="To..." className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>
                                        <div className="flex flex-row gap-3 items-end">
                                            <div className="flex-1 w-full md:w-32 md:flex-none">
                                                <label className="text-xs font-semibold text-gray-500 mb-1 block">Return Distance (KM)</label>
                                                <input type="number" value={returnKm} onChange={e => setReturnKm(e.target.value)} disabled={isResolved} placeholder="Return KM" className="w-full p-2.5 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end pt-2 border-t border-gray-100 pointer-events-auto">
                                <button onClick={handleSaveVisitEntry} className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm active:scale-95">
                                    {isResolved ? 'Next Section' : 'Save & Next'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- MODULE 2: PROBLEM & SOLUTION --- */}
                <div className={`bg-white rounded-2xl p-6 shadow-sm border ${activeSection === 'RESOLUTION' ? 'border-[#2a8bf2] ring-2 ring-[#2a8bf2]/20' : 'border-gray-200'} transition-all`}>
                    <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setActiveSection('RESOLUTION')}>
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">2</div>
                        <h2 className="text-xl font-bold text-gray-800">Problem & Solution</h2>
                    </div>

                    {activeSection === 'RESOLUTION' && (
                        <div className={`flex flex-col gap-4 animate-fadeIn ${readOnlyClasses}`}>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-gray-600">Problem 1 (From Admin) {!isResolved && <span className="text-red-500">*</span>}</label>
                                <textarea value={problem1} readOnly rows="2" className="p-2.5 rounded-xl border border-gray-300 bg-gray-100 text-gray-600 focus:outline-none cursor-not-allowed" placeholder="Describe the primary issue..."></textarea>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-gray-600">Problem 2 (Optional)</label>
                                <textarea value={problem2} onChange={e => setProblem2(e.target.value)} disabled={isResolved} rows="2" className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Additional issues if any..."></textarea>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-semibold text-gray-600">Solution {!isResolved && <span className="text-red-500">*</span>}</label>
                                <textarea value={solution} onChange={e => setSolution(e.target.value)} disabled={isResolved} rows="3" className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none bg-green-50/50" placeholder="Describe the actions taken to resolve..."></textarea>
                            </div>
                            <div className="flex justify-end pt-2 border-t border-gray-100 mt-2 pointer-events-auto">
                                <button onClick={handleSaveProblemSolution} className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm active:scale-95">
                                    {isResolved ? 'Next Section' : 'Save & Go to Stock'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- MODULE 3: STOCK ENTRY --- */}
                <div className={`bg-white rounded-2xl p-6 shadow-sm border ${activeSection === 'STOCK' ? 'border-[#2a8bf2] ring-2 ring-[#2a8bf2]/20' : 'border-gray-200'} transition-all`}>
                    <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setActiveSection('STOCK')}>
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">3</div>
                        <h2 className="text-xl font-bold text-gray-800">Stock Entry</h2>
                    </div>

                    {activeSection === 'STOCK' && (
                        <div className={`flex flex-col gap-4 animate-fadeIn ${readOnlyClasses}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Item Type</label>
                                    <input type="text" value={itemType} readOnly className="p-2.5 rounded-xl border border-gray-300 bg-gray-100 text-gray-500 outline-none" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Item Name</label>
                                    <select value={itemName} onChange={e => setItemName(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="">Select Item...</option>
                                        {stocks.map(stock => (
                                            <option key={stock.engineer_stock_id} value={stock.name}>
                                                {stock.name} (Qty: {stock.engineer_quantity})
                                            </option>
                                        ))}
                                        {itemName && !stocks.find(s => s.name === itemName) && <option value={itemName}>{itemName}</option>}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Quantity</label>
                                    <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={isResolved} min="1" className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Serial Number {!isResolved && <span className="text-red-500">*</span>}</label>
                                    <input type="text" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} disabled={isResolved} placeholder="S/N..." className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none border-red-200" />
                                </div>
                                <div className="flex flex-col gap-1 md:col-span-2">
                                    <label className="text-sm font-semibold text-gray-600">Under Warranty</label>
                                    <select value={underWarranty} onChange={e => setUnderWarranty(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </div>
                                {underWarranty === 'Yes' && (
                                    <div className="md:col-span-2 flex flex-col gap-4 bg-amber-50 border border-amber-200 p-4 rounded-xl">
                                        <div className="flex items-center gap-3 text-amber-800 text-sm font-medium">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            Return Entry required for Warranty items. Please provide the old part details.
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-sm font-semibold text-amber-900">Old Part Name {!isResolved && <span className="text-red-500">*</span>}</label>
                                                <input type="text" value={returnPartName} onChange={e => setReturnPartName(e.target.value)} disabled={isResolved} placeholder="Name of old part..." className="p-2.5 rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 outline-none" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-sm font-semibold text-amber-900">Old Part S/N {!isResolved && <span className="text-red-500">*</span>}</label>
                                                <input type="text" value={returnSerialNumber} onChange={e => setReturnSerialNumber(e.target.value)} disabled={isResolved} placeholder="Old part S/N..." className="p-2.5 rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col gap-1 md:col-span-2">
                                    <label className="text-sm font-semibold text-gray-600">Remarks</label>
                                    <textarea value={remarks} onChange={e => setRemarks(e.target.value)} disabled={isResolved} rows="2" className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Any additional notes..."></textarea>
                                </div>
                            </div>
                            <div className="flex justify-end pt-2 border-t border-gray-100 mt-2 pointer-events-auto">
                                <button onClick={handleSaveStock} className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm active:scale-95">
                                    {isResolved ? 'Next Section' : 'Save Stock Entry'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- MODULE 4: CALL STATUS & ATTACHMENT --- */}
                <div className={`bg-white rounded-2xl p-6 shadow-sm border ${activeSection === 'STATUS' ? 'border-[#2a8bf2] ring-2 ring-[#2a8bf2]/20' : 'border-gray-200'} transition-all`}>
                    <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setActiveSection('STATUS')}>
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">4</div>
                        <h2 className="text-xl font-bold text-gray-800">Finalize & Submit</h2>
                    </div>

                    {activeSection === 'STATUS' && (
                        <div className={`flex flex-col gap-4 animate-fadeIn ${readOnlyClasses}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Call Status</label>
                                    <select value={callStatus} onChange={e => setCallStatus(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold disabled:opacity-75">
                                        <option value="pending">Pending</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="solved by helpdesk">Solved by Helpdesk</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 mt-4 md:mt-0">
                                    <input type="checkbox" id="letterheadReceived" checked={letterheadReceived} onChange={e => setLetterheadReceived(e.target.checked)} disabled={isResolved} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50" />
                                    <label htmlFor="letterheadReceived" className="text-sm font-semibold text-gray-600 cursor-pointer">Letterhead Received / Submitted</label>
                                </div>
                                {!isResolved && (
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                        <label className="text-sm font-semibold text-gray-600">Letterhead Attachment (Img/Doc)</label>
                                        <input type="file" accept="image/*,.doc,.docx,.pdf" onChange={e => setAttachment(e.target.files[0])} className="p-2 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                        {attachment && <p className="text-xs text-green-600 font-medium mt-1">✓ {attachment.name} selected</p>}
                                        {callData?.letterhead_url && !attachment && <p className="text-xs text-blue-600 font-medium mt-1">✓ Existing attachment stored</p>}
                                    </div>
                                )}
                            </div>

                            {!isResolved && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-2">
                                    <p className="text-sm text-blue-800 font-medium">After submission, the system will update the main dashboard to reflect the <span className="font-bold underline">{callStatus}</span> status of this call.</p>
                                </div>
                            )}

                            <div className="pointer-events-auto">
                                <button onClick={handleSubmitStatus} className={`w-full font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 text-lg mt-4 flex items-center justify-center gap-2 ${isResolved ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-[#10b981] hover:bg-[#059669] text-white'}`}>
                                    {isResolved ? 'Call Resolved - Back to Dashboard' : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                            Submit All & Finish
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- MODULE 5: TA ENTRY ---
                <div className={`bg-white rounded-2xl p-6 shadow-sm border ${activeSection === 'TA' ? 'border-[#2a8bf2] ring-2 ring-[#2a8bf2]/20' : 'border-gray-200'} transition-all`}>
                    <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setActiveSection('TA')}>
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">5</div>
                        <h2 className="text-xl font-bold text-gray-800">TA Entry</h2>
                    </div>

                    {activeSection === 'TA' && (
                        <div className={`flex flex-col gap-4 animate-fadeIn ${readOnlyClasses}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Call ID</label>
                                    <select value={selectedCallId} onChange={handleCallIdSelect} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-75">
                                        <option value="">Select Call ID...</option>
                                        <option value={callData?.call_id || "CALL-001"}>{callData?.call_id || "CALL-001"}</option>
                                        <option value="CALL-002">CALL-002</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Voucher Number (Auto)</label>
                                    <input type="text" value={voucherNumber} readOnly className="p-2.5 rounded-xl border border-gray-300 bg-gray-100 text-gray-500 outline-none" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">From Date</label>
                                    <input type="date" value={travelFromDate} onChange={e => setTravelFromDate(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">To Date</label>
                                    <input type="date" value={travelToDate} onChange={e => setTravelToDate(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Mode of Travel</label>
                                    <select value={modeOfTravel} onChange={e => setModeOfTravel(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="">Select Mode...</option>
                                        <option value="Car">Car</option>
                                        <option value="Bike">Bike</option>
                                        <option value="Public Travel">Public Travel</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-semibold text-gray-600">Type</label>
                                    <select value={travelType} onChange={e => setTravelType(e.target.value)} disabled={isResolved} className="p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="">Select Type...</option>
                                        <option value="Service Call">Service Call</option>
                                        <option value="PM Call">PM Call</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end mt-2 pointer-events-auto">
                                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm active:scale-95 disabled:opacity-75" onClick={() => { setActiveSection('VISIT') }}>Continue to Visit Entry</button>
                            </div>
                        </div>
                    )}
                </div> */}

            </div>

            <style jsx="true">{`
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-in-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default EAssignCall;
