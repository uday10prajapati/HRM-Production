import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Geolocation } from '@capacitor/geolocation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const EAttandance = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [punchState, setPunchState] = useState('in'); // 'in' means ready to punch in, 'out' means ready to punch out
    const [history, setHistory] = useState([]);
    const [delayMessage, setDelayMessage] = useState('');

    // Missed punch modal state
    const [showMissedPunch, setShowMissedPunch] = useState(false);
    const [missedForm, setMissedForm] = useState({ date: '', time: '', type: 'in', reason: '' });

    // Confirm punch modal state
    const [showConfirmPunch, setShowConfirmPunch] = useState(false);

    // Default dates for today's filter
    const todayStr = new Date().toISOString().split('T')[0];
    const [fromDate] = useState(todayStr);
    const [toDate] = useState(todayStr);

    // TA Entry State
    const searchParams = new URLSearchParams(window.location.search);
    const initialTab = searchParams.get('tab') === 'ta' ? 'ta' : 'attendance';
    // Detect sidebar navigation: either has ?tab parameter OR no query params (direct sidebar link)
    const isFromSidebar = !!searchParams.get('tab') || Object.keys(Object.fromEntries(searchParams)).length === 0;
    const [activeMainTab, setActiveMainTab] = useState(initialTab); // 'attendance' or 'ta'
    
    // Update URL to include tab parameter when loaded without one (for consistency)
    useEffect(() => {
        if (!searchParams.get('tab') && initialTab) {
            window.history.replaceState({}, '', `?tab=${initialTab}`);
        }
    }, []);
    const [taVoucherDate, setTaVoucherDate] = useState(todayStr);
    const [taVoucherNumber, setTaVoucherNumber] = useState('TA-' + Math.floor(100000 + Math.random() * 900000));
    const [taCallType, setTaCallType] = useState('Service Call');
    const [taStartDate, setTaStartDate] = useState(todayStr);
    const [taEndDate, setTaEndDate] = useState(todayStr);
    const [taTravelMode, setTaTravelMode] = useState('Bike');
    const [resolvedCalls, setResolvedCalls] = useState([]);
    const [taEntries, setTaEntries] = useState([]);
    const [selectedTaCall, setSelectedTaCall] = useState('');
    const [taAutoVisit, setTaAutoVisit] = useState(null);
    const [taPlaces, setTaPlaces] = useState([]);
    const [taReturnHome, setTaReturnHome] = useState('No');
    const [taReturnFrom, setTaReturnFrom] = useState('');
    const [taReturnTo, setTaReturnTo] = useState('');
    const [taReturnKm, setTaReturnKm] = useState('');
    const [taReceiptFile, setTaReceiptFile] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);

            // Set user auth header specifically for the backend's middleware
            axios.defaults.headers.common['x-user-id'] = parsed.id;

            // Only fetch for attendance tab, not TA
            if (activeMainTab === 'attendance') {
                fetchTodayStatus(parsed.id);
                fetchHistory(parsed.id, fromDate, toDate);
            }
        } else {
            navigate('/');
        }
    }, [navigate, fromDate, toDate, activeMainTab]);

    // Fetch resolved calls whenever TA tab is active or dates/type vary
    useEffect(() => {
        if (user && activeMainTab === 'ta') {
            fetchResolvedCalls(user.id);
        }
    }, [user, activeMainTab, taStartDate, taEndDate, taCallType]);

    const fetchResolvedCalls = async (userId) => {
        try {
            const res = await axios.get('/api/service-calls/assigned-calls');
            if (res.data.success) {
                // Calculate DDMMYY/sequence for ALL calls before filtering to ensure ID consistency with Dashboard
                const sorted = [...res.data.calls].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                const dateCounts = {};
                const callsWithId = sorted.map(c => {
                    const d = new Date(c.created_at);
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yy = String(d.getFullYear()).slice(-2);
                    const dateKey = `${dd}${mm}${yy}`;

                    if (!dateCounts[dateKey]) dateCounts[dateKey] = 0;
                    dateCounts[dateKey]++;
                    return { ...c, sequence_id: `${dateKey}/${dateCounts[dateKey]}` };
                });

                const calls = callsWithId.filter(c =>
                    (String(c.id) === String(userId) || String(c.engineer_id) === String(userId)) &&
                    String(c.status).toLowerCase() === 'resolved'
                );

                const availableCalls = calls.filter(c => !c.ta_voucher_number || c.ta_voucher_number === 'null');

                // Keep track of counts for user feedback
                c_totalResolvedRef.current = calls.length;
                c_availRef.current = availableCalls.length;

                setResolvedCalls(availableCalls);
            }
        } catch (error) {
            console.error("Failed to fetch TA calls:", error);
        }
    };

    const c_totalResolvedRef = React.useRef(0);
    const c_availRef = React.useRef(0);

    const handleTaCallSelect = (e) => {
        const val = e.target.value;
        if (!val) {
            setSelectedTaCall('');
            return;
        }

        const call = resolvedCalls.find(c => String(c.call_id) === String(val));
        if (!call) return;

        if (taEntries.find(entry => String(entry.call_id) === String(val))) {
            toast.error('Call already added in this voucher');
            setSelectedTaCall(''); // Reset dropdown
            return;
        }

        // Check if call is already selected
        if (String(selectedTaCall) === String(val)) {
            return;
        }

        // Auto format places
        let initialPlaces = [];
        if (call.places_visited) {
            try {
                const parsed = JSON.parse(call.places_visited);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    initialPlaces = parsed;
                } else {
                    initialPlaces = [{ from: call.places_visited, to: '...', distance: call.kms_traveled || '' }];
                }
            } catch (err) {
                initialPlaces = [{ from: call.places_visited, to: '...', distance: call.kms_traveled || '' }];
            }
        } else {
            initialPlaces = [{ from: '', to: '', distance: call.kms_traveled || '' }];
        }

        let retHome = 'No';
        let retFrom = '';
        let retTo = '';
        let retKm = call.return_km || '';

        if (call.return_to_home === true || String(call.return_to_home).toLowerCase() === 'true' || String(call.return_to_home).toLowerCase() === 'yes' || call.return_to_home === 1) {
            retHome = 'Yes';
            if (call.return_place) {
                try {
                    const parsedRet = JSON.parse(call.return_place);
                    retFrom = parsedRet.from || '';
                    retTo = parsedRet.to || '';
                } catch (e) {
                    retFrom = call.return_place;
                }
            }
        }

        let totalKm = initialPlaces.reduce((sum, p) => sum + (parseFloat(p.distance) || 0), 0);
        if (retHome === 'Yes') totalKm += parseFloat(retKm) || 0;

        let placesArr = [...initialPlaces];
        if (retHome === 'Yes') {
            placesArr.push({ from: retFrom, to: retTo, distance: retKm, isReturn: true });
        }
        const placesText = placesArr.map(p => `${p.from} to ${p.to}`).join(', ');

        const autoVisit = {
            startTime: call.visit_start_time || '',
            endTime: call.visit_end_time || ''
        };

        setTaEntries([...taEntries, {
            call_id: val,
            sequence_id: call?.sequence_id || val,
            km: totalKm,
            startTime: autoVisit.startTime,
            endTime: autoVisit.endTime,
            places: placesText || 'Not specified',
            placesJson: JSON.stringify(placesArr)
        }]);

        setSelectedTaCall(''); // Ensure dropdown reverts and blue box stays hidden!
        setTaAutoVisit(null);
    };

    // Cancel call selection
    const handleCancelTaSelection = () => {
        setSelectedTaCall('');
        setTaAutoVisit(null);
        setTaPlaces([{ from: '', to: '', distance: '' }]);
        setTaReturnHome('No');
        setTaReturnFrom('');
        setTaReturnTo('');
        setTaReturnKm('');
        toast.info('Selection cleared');
    };

    const handleAddTaEntry = () => {
        if (!selectedTaCall) { toast.error('Select a call first'); return; }
        if (taEntries.find(e => String(e.call_id) === String(selectedTaCall))) {
            toast.error('Call already added in this voucher');
            return;
        }

        const call = resolvedCalls.find(c => String(c.call_id) === String(selectedTaCall));

        for (let p of taPlaces) {
            if (!p.from || !p.to || !p.distance) {
                toast.error('All Place (From/To) and Distance (KM) fields are mandatory!');
                return;
            }
        }
        if (taReturnHome === 'Yes' && (!taReturnFrom || !taReturnTo || !taReturnKm)) {
            toast.error('Return Places and KM are mandatory when Return Home is Yes!');
            return;
        }

        let totalKm = taPlaces.reduce((sum, p) => sum + (parseFloat(p.distance) || 0), 0);
        if (taReturnHome === 'Yes') totalKm += parseFloat(taReturnKm) || 0;

        let placesArr = [...taPlaces];
        if (taReturnHome === 'Yes') {
            placesArr.push({ from: taReturnFrom, to: taReturnTo, distance: taReturnKm, isReturn: true });
        }
        const placesText = placesArr.map(p => `${p.from} to ${p.to}`).join(', ');

        setTaEntries([...taEntries, {
            call_id: selectedTaCall,
            sequence_id: call?.sequence_id || selectedTaCall,
            km: totalKm,
            startTime: taAutoVisit.startTime,
            endTime: taAutoVisit.endTime,
            places: placesText,
            placesJson: JSON.stringify(placesArr)
        }]);
        setSelectedTaCall('');
        setTaAutoVisit(null);
    };

    const handleEditTaEntry = (idx) => {
        const entry = taEntries[idx];
        setSelectedTaCall(entry.call_id);

        let placesArr = [];
        try {
            placesArr = JSON.parse(entry.placesJson || '[]');
        } catch {
            placesArr = [{ from: '', to: '', distance: '' }];
        }

        const returnPlaceIndex = placesArr.findIndex(p => p.isReturn);
        if (returnPlaceIndex >= 0) {
            setTaReturnHome('Yes');
            setTaReturnFrom(placesArr[returnPlaceIndex].from);
            setTaReturnTo(placesArr[returnPlaceIndex].to);
            setTaReturnKm(placesArr[returnPlaceIndex].distance);
            placesArr.splice(returnPlaceIndex, 1);
        } else {
            setTaReturnHome('No');
            setTaReturnFrom('');
            setTaReturnTo('');
            setTaReturnKm('');
        }

        setTaPlaces(placesArr.length > 0 ? placesArr : [{ from: '', to: '', distance: '' }]);
        setTaAutoVisit({
            startTime: entry.startTime,
            endTime: entry.endTime
        });

        // Remove from list so it can be re-saved
        setTaEntries(taEntries.filter((_, i) => i !== idx));

        // Scroll back to the select call section
        setTimeout(() => {
            const section = document.getElementById('ta-voucher-edit-section');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleSubmitTa = async () => {
        if (taEntries.length === 0) {
            toast.error('Add at least one call entry to TA voucher');
            return;
        }
        setLoading(true);
        try {
            let receiptUrl = null;
            if (taReceiptFile) {
                toast.info('Uploading TA Receipt...');
                const formData = new FormData();
                formData.append('file', taReceiptFile);

                const uploadRes = await axios.post('/api/service-calls/upload-attachment', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (uploadRes.data.success) {
                    receiptUrl = uploadRes.data.url;
                } else {
                    toast.error('Failed to upload receipt.');
                    setLoading(false);
                    return; // Stop submission
                }
            }

            const payload = {
                voucherDate: taVoucherDate,
                voucherNumber: taVoucherNumber,
                callType: taCallType,
                startDate: taStartDate,
                endDate: taEndDate,
                travelMode: taTravelMode,
                entries: taEntries.map(e => ({
                    call_id: e.call_id,
                    km: e.km,
                    places: e.placesJson || e.places
                })),
                receiptUrl: receiptUrl
            };
            const res = await axios.post('/api/service-calls/submit-ta', payload);
            if (res.data.success) {
                toast.success('TA Voucher Submitted successfully!');
                setTaVoucherNumber('TA-' + Math.floor(100000 + Math.random() * 900000));
                setTaEntries([]);
                setTaReceiptFile(null);
                const fileInput = document.getElementById('ta-receipt');
                if (fileInput) fileInput.value = '';
                // Trigger refetch
                fetchResolvedCalls(user.id);
            }
        } catch (err) {
            toast.error('Failed to submit TA');
        } finally {
            setLoading(false);
        }
    };

    const fetchTodayStatus = async (userId) => {
        try {
            const res = await axios.get(`/api/attendance/latest?userId=${userId}`);
            if (res.data.success) {
                const { punch_in, punch_out } = res.data.data;
                if (punch_in && !punch_out) {
                    setPunchState('out'); // Need to punch out
                } else {
                    setPunchState('in'); // Default ready to punch in
                }
            }
        } catch (error) {
            console.error("Failed to fetch today's status:", error);
        }
    };

    const fetchHistory = async (userId, start, end) => {
        try {
            const res = await axios.get(`/api/attendance/records?userId=${userId}&start=${start}&end=${end}`);
            if (res.data.success) {
                setHistory(res.data.rows);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
        }
    };

    const calculateDelay = () => {
        const now = new Date();
        const target = new Date();
        target.setHours(10, 0, 0, 0); // 10:00 AM

        if (now > target) {
            const diffMs = now - target;
            const diffMins = Math.floor(diffMs / 60000);
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            if (hours > 0) {
                return `Delayed by ${hours} hr ${mins} min`;
            } else {
                return `Delayed by ${mins} min`;
            }
        }
        return 'On Time';
    };

    const handlePunchClick = () => {
        if (!user || loading) return;
        setShowConfirmPunch(true);
    };

    const confirmPunch = async () => {
        setShowConfirmPunch(false);
        if (!user) return;
        setLoading(true);

        try {
            // Check permissions & get location
            let permission = await Geolocation.checkPermissions();
            if (permission.location !== 'granted') {
                permission = await Geolocation.requestPermissions();
                if (permission.location !== 'granted') {
                    toast.error("Location permission heavily required for attendance!");
                    setLoading(false);
                    return;
                }
            }

            toast.info("Acquiring GPS Location...", { autoClose: 2000 });
            const coordinates = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 10000 // Allow a 10s old cached location to speed it up
            });

            const currentType = punchState; // 'in' or 'out'

            let computedDelay = null;
            let isHalfDay = false;
            if (currentType === 'in') {
                const now = new Date();
                const d = calculateDelay();
                if (d !== 'On Time') computedDelay = d;
                if (now.getHours() >= 12) isHalfDay = true;
            }

            const payload = {
                userId: user.id,
                punch_type: currentType,
                type: currentType, // backend uses both slightly interchangably
                latitude: coordinates.coords.latitude,
                longitude: coordinates.coords.longitude,
                notes: 'Mobile App Punch',
                delay_time: computedDelay,
                is_half_day: isHalfDay
            };

            const res = await axios.post('/api/attendance/punch', payload);
            if (res.data.success) {
                toast.success(`Successfully Punched ${currentType === 'in' ? 'In' : 'Out'}!`);

                if (currentType === 'in') {
                    if (computedDelay) {
                        setDelayMessage(computedDelay);
                        toast.warning(isHalfDay ? `Half Day Marked. ${computedDelay}` : `You are ${computedDelay}`);
                    } else {
                        setDelayMessage('');
                        if (isHalfDay) toast.warning('Half Day Marked.');
                    }
                    setPunchState('out'); // Now require punch out
                } else {
                    setPunchState('in'); // Reset state if they punched out
                }

                // Refresh history and status
                fetchHistory(user.id, fromDate, toDate);
            } else {
                toast.error(res.data.message || "Failed to record attendance.");
            }
        } catch (error) {
            console.error("Punch Error:", error);
            toast.error("Error connecting to location or server services. Ensure GPS is ON.");
        } finally {
            setLoading(false);
        }
    };


    const submitMissedPunch = async () => {
        if (!missedForm.date || !missedForm.time || !missedForm.reason) {
            toast.error("Please fill all fields.");
            return;
        }
        try {
            setLoading(true);
            const punchTimeIso = new Date(`${missedForm.date}T${missedForm.time}`).toISOString();
            const payload = {
                userId: user.id,
                type: missedForm.type,
                punch_time: punchTimeIso,
                notes: missedForm.reason
            };
            const res = await axios.post('/api/attendance/request', payload);
            if (res.data.success) {
                toast.success("Missed punch report sent to HR/Admin!");
                setShowMissedPunch(false);
                setMissedForm({ date: '', time: '', type: 'in', reason: '' });
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to submit report.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f7fa] flex flex-col font-sans pb-6">
            <ToastContainer position="top-center" limit={2} />

            {/* Header */}
            <div className="bg-white px-5 py-4 flex items-center shadow-sm sticky top-0 z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors mr-3"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-gray-800">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight flex-1">{activeMainTab === 'ta' ? 'TA Entry' : 'Attendance'}</h1>
            </div>

            {!isFromSidebar && (
            <div className="px-4 mt-2">
                <div className="flex bg-gray-200 rounded-xl p-1 w-full shadow-sm">
                    <button
                        onClick={() => {
                            setActiveMainTab('attendance');
                            window.history.pushState({}, '', '?tab=attendance');
                        }}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeMainTab === 'attendance' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Attendance
                    </button>
                    <button
                        onClick={() => {
                            setActiveMainTab('ta');
                            window.history.pushState({}, '', '?tab=ta');
                        }}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeMainTab === 'ta' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        TA Entry
                    </button>
                </div>
            </div>
            )}

            <div className="flex-1 px-4 py-2 flex flex-col gap-5">

                {activeMainTab === 'attendance' && (
                    <>
                        {/* Punch Card Section */}
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-1.5 bg-blue-500 left-0"></div>

                            <h2 className="text-xl font-bold text-gray-800 mb-1">Mark Attendance</h2>
                            <p className="text-sm text-gray-500 mb-6 text-center">Standard Hours: 10:00 AM - 7:00 PM<br />Location must be enabled.</p>

                            {delayMessage && punchState === 'out' && (
                                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold mb-5 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                    </svg>
                                    {delayMessage}
                                </div>
                            )}

                            <button
                                onClick={handlePunchClick}
                                disabled={loading}
                                className={`w-40 h-40 rounded-full flex flex-col items-center justify-center font-bold text-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all active:scale-95 ${loading ? 'bg-gray-200 text-gray-400 border-4 border-gray-100' : (punchState === 'in' ? 'bg-emerald-50 text-emerald-600 border-[6px] border-emerald-100 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-[6px] border-rose-100 hover:bg-rose-100')}`}
                            >
                                {loading ? (
                                    <span className="animate-pulse">Tracking...</span>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10 mb-2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
                                        </svg>
                                        {punchState === 'in' ? 'Punch In' : 'Punch Out'}
                                    </>
                                )}
                            </button>
                            {punchState === 'out' && <p className="text-xs font-semibold text-gray-400 mt-5">You are currently checked in.</p>}

                            <button
                                onClick={() => setShowMissedPunch(true)}
                                className="mt-6 text-sm font-semibold text-blue-500 underline decoration-blue-200 underline-offset-4 hover:text-blue-600 transition-colors"
                            >
                                Forgot to punch in/out? Send Report
                            </button>
                        </div>

                        {/* History Section */}
                        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 mt-2">
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">Today's Attendance</h3>
                                <button
                                    onClick={() => navigate('/engineer-attendance-report')}
                                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                    View Reports
                                </button>
                            </div>

                            <div className="flex flex-col">
                                {history.length > 0 ? (
                                    history.map(record => (
                                        <div key={record.id} className="p-4 border-b border-gray-50 flex justify-between items-center bg-white hover:bg-gray-50">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${record.type === 'in' || record.type === 'punch_in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {record.type === 'in' || record.type === 'punch_in' ? 'Punch In' : 'Punch Out'}
                                                    </span>
                                                    {record.is_half_day && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-orange-100 text-orange-700 font-extrabold uppercase tracking-wide">
                                                            Half Day
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-400 font-bold">{record.created_at.split(' ')[0]}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[15px] font-bold text-gray-800">{record.created_at.split(' ')[1]} {record.created_at.split(' ')[2]}</span>
                                                    {record.delay_time && (
                                                        <span className="text-[11px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">
                                                            Delayed: {record.delay_time}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-1">
                                                <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                        <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11 0 .308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                                                    </svg>
                                                    Location Secured
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-gray-400 text-sm font-medium">
                                        No records found for these dates.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeMainTab === 'ta' && (
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4 mb-10 overflow-hidden relative">
                        <div className="absolute top-0 w-full h-1.5 bg-blue-500 left-0"></div>
                        <div className="flex justify-between items-center mb-1">
                            <h2 className="text-xl font-bold text-gray-800 tracking-tight">TA Voucher Entry</h2>
                            <button
                                onClick={() => navigate('/engineer-ta-report')}
                                className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                TA History
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {/* --- 1. Header Section --- */}
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">1. Header Information</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-gray-500">Voucher Date <span className="text-red-500">*</span></label>
                                        <input type="date" value={taVoucherDate} onChange={e => setTaVoucherDate(e.target.value)} className="w-full text-sm p-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-gray-500">Voucher No <span className="text-[10px] text-gray-400">(Auto)</span></label>
                                        <input type="text" value={taVoucherNumber} readOnly className="w-full text-sm p-2 rounded-xl border border-gray-200 bg-gray-100 text-gray-600 outline-none cursor-not-allowed font-medium" />
                                    </div>
                                </div>
                            </div>

                            {/* --- 2. Call Type & 3. Date Range & 4. Travel Mode --- */}
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3">
                                <h3 className="text-sm font-bold text-gray-700 mb-1 border-b pb-2">2. Filter Resolved Calls</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1 col-span-2">
                                        <label className="block text-xs font-bold text-gray-500">Call Type <span className="text-red-500">*</span></label>
                                        <select value={taCallType} onChange={e => setTaCallType(e.target.value)} className="w-full text-sm p-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                            <option value="Service Call">Service Call</option>
                                            <option value="PM Call">PM Call</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="block text-xs font-bold text-gray-500">Start Date <span className="text-red-500">*</span></label>
                                        <input type="date" value={taStartDate} onChange={e => setTaStartDate(e.target.value)} max={taEndDate} className="w-full text-sm p-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="block text-xs font-bold text-gray-500">End Date <span className="text-red-500">*</span></label>
                                        <input type="date" value={taEndDate} onChange={e => setTaEndDate(e.target.value)} min={taStartDate} className="w-full text-sm p-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div className="flex flex-col gap-1 col-span-2">
                                        <label className="block text-xs font-bold text-gray-500">Travel Mode <span className="text-red-500">*</span></label>
                                        <div className="flex gap-2">
                                            {['Bike', 'Car', 'Public Transport'].map(mode => (
                                                <button key={mode} onClick={() => setTaTravelMode(mode)} className={`flex-1 text-xs py-2 px-1 font-bold rounded-lg border transition-all ${taTravelMode === mode ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- 5. & 6. Call Number & Fetching details --- */}
                            <div id="ta-voucher-edit-section" className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3">
                                <h3 className="text-sm font-bold text-gray-700 mb-1 border-b pb-2">3. Select Call & Add {selectedTaCall && "(Editing Mode)"}</h3>

                                <div className="flex flex-col gap-1">
                                    <label className="block text-xs font-bold text-gray-500">Call Number <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2">
                                        <select value={selectedTaCall} onChange={handleTaCallSelect} disabled={!!selectedTaCall} className={`flex-1 text-sm p-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none ${selectedTaCall ? 'opacity-70 bg-gray-100 cursor-not-allowed' : ''}`}>
                                            <option value="">-- Auto Fetch Resolved Calls --</option>
                                            {resolvedCalls
                                                .filter(c => !taEntries.find(e => String(e.call_id) === String(c.call_id)))
                                                .map(c => (
                                                    <option key={c.call_id} value={c.call_id}>ID: {c.sequence_id} • {c.dairy_name}</option>
                                                ))}
                                        </select>
                                        {selectedTaCall && (
                                            <button
                                                onClick={handleCancelTaSelection}
                                                className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors text-sm whitespace-nowrap"
                                                title="Clear selection"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>

                                    {/* Show intelligent feedback about why calls might be missing */}
                                    {resolvedCalls.length === 0 && (
                                        <div className="text-[10px] text-orange-500 mt-1 font-semibold flex flex-col gap-0.5">
                                            <p>No available calls found to add.</p>
                                            <ul className="list-disc pl-3 text-gray-400 mt-1">
                                                <li>Total resolved calls: {c_totalResolvedRef.current}</li>
                                                {c_totalResolvedRef.current > c_availRef.current && (
                                                    <li className="text-orange-400 font-bold">Already Vouchered: {c_totalResolvedRef.current - c_availRef.current} (these are hidden)</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {taAutoVisit && (
                                    <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mt-1 animate-fadeIn flex flex-col gap-3">
                                        <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                                            <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-widest">Fetched Visit Details</p>
                                            <p className="text-xs text-indigo-900 font-bold">{taAutoVisit.startTime} - {taAutoVisit.endTime}</p>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            {taPlaces.map((place, index) => (
                                                <div key={index} className="flex flex-col gap-2 pb-2 border-b border-indigo-100 last:border-0 last:pb-0">
                                                    <div className="flex flex-row gap-2">
                                                        <div className="flex-1">
                                                            <label className="text-[10px] font-semibold text-indigo-600 mb-0.5 block">Place (From)</label>
                                                            <input type="text" value={place.from} onChange={e => { const np = [...taPlaces]; np[index].from = e.target.value; setTaPlaces(np); }} className="w-full p-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-[10px] font-semibold text-indigo-600 mb-0.5 block">Place (To)</label>
                                                            <input type="text" value={place.to} onChange={e => { const np = [...taPlaces]; np[index].to = e.target.value; setTaPlaces(np); }} className="w-full p-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900" />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-row gap-2 items-end">
                                                        <div className="flex-1">
                                                            <label className="text-[10px] font-semibold text-indigo-600 mb-0.5 block">Distance (KM)</label>
                                                            <input type="number" value={place.distance} onChange={e => { const np = [...taPlaces]; np[index].distance = e.target.value; setTaPlaces(np); }} className="w-full p-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900" />
                                                        </div>
                                                        {taPlaces.length > 1 && (
                                                            <button onClick={() => setTaPlaces(taPlaces.filter((_, i) => i !== index))} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center">
                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            <button onClick={() => setTaPlaces([...taPlaces, { from: '', to: '', distance: '' }])} className="text-[11px] font-bold text-indigo-600 bg-indigo-100 py-1.5 rounded hover:bg-indigo-200 transition-colors self-start px-3">+ Add Place</button>
                                        </div>

                                        <div className="flex flex-col gap-2 bg-white/50 p-3 rounded-lg border border-indigo-100 mt-1">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-semibold text-indigo-600">Return Home</label>
                                                <select value={taReturnHome} onChange={e => setTaReturnHome(e.target.value)} className="p-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900 w-full md:w-1/2">
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </div>
                                            {taReturnHome === 'Yes' && (
                                                <div className="flex flex-col gap-2 pt-2 border-t border-indigo-100 border-dashed mt-1">
                                                    <div className="flex flex-row gap-2">
                                                        <div className="flex-1">
                                                            <label className="text-[10px] font-semibold text-indigo-600 mb-0.5 block">Place (From)</label>
                                                            <input type="text" value={taReturnFrom} onChange={e => setTaReturnFrom(e.target.value)} className="w-full p-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-[10px] font-semibold text-indigo-600 mb-0.5 block">Place (To)</label>
                                                            <input type="text" value={taReturnTo} onChange={e => setTaReturnTo(e.target.value)} className="w-full p-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-semibold text-indigo-600 mb-0.5 block">Return Distance (KM)</label>
                                                        <input type="number" value={taReturnKm} onChange={e => setTaReturnKm(e.target.value)} className="w-full md:w-1/2 p-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-indigo-900" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <button onClick={handleAddTaEntry} className="mt-2 w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all text-center flex justify-center items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                            Save Edited Changes
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* --- 7. Added Entries List --- */}
                            {taEntries.length > 0 && (
                                <div className="p-4 bg-white rounded-2xl border-2 border-green-100 shadow-sm flex flex-col gap-2 mb-2">
                                    <h3 className="text-sm font-bold text-green-700 mb-1 border-b border-green-50 pb-2">4. TA Voucher Entries ({taEntries.length})</h3>
                                    {taEntries.map((e, idx) => (
                                        <div key={idx} className="flex flex-col p-2 bg-green-50 rounded-lg border border-green-100 text-xs text-green-800 font-medium relative pr-8">
                                            <span className="font-bold text-green-900">ID: {e.sequence_id}</span>
                                            <span>KM: {e.km} | Time: {e.startTime}-{e.endTime}</span>
                                            <span className="truncate">Visits: {e.places}</span>
                                            <div className="absolute right-2 top-2 flex flex-col gap-1.5">
                                                <button onClick={() => handleEditTaEntry(idx)} className="p-1.5 text-blue-600 bg-blue-100 rounded hover:bg-blue-200 transition-colors shadow-sm" title="Edit Entry">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.12l-2.83.899a.75.75 0 01-.94-.94l.899-2.83a4.5 4.5 0 011.12-1.89l13.682-13.682z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.862 4.487" /></svg>
                                                </button>
                                                <button onClick={() => setTaEntries(taEntries.filter((_, i) => i !== idx))} className="p-1.5 text-red-500 bg-red-100 rounded hover:bg-red-200 transition-colors shadow-sm" title="Remove Entry">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* --- 8. Upload Receipt --- */}
                            <div className="flex flex-col gap-1.5 mt-2 mb-2 p-3 bg-gray-50 border border-gray-100 rounded-2xl">
                                <label className="block text-sm font-bold text-gray-700">Upload Receipt <span className="text-[10px] font-normal text-gray-400">(Fuel/Ticket) Optional</span></label>
                                <input
                                    type="file"
                                    id="ta-receipt"
                                    accept="image/*,.pdf"
                                    onChange={e => setTaReceiptFile(e.target.files[0])}
                                    className="w-full text-xs p-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>

                            {/* --- 9. Submit Button --- */}
                            <button
                                onClick={handleSubmitTa}
                                disabled={loading || taEntries.length === 0}
                                className="w-full py-3.5 bg-[#10b981] text-white font-bold rounded-xl text-[15px] shadow-lg hover:bg-[#059669] active:scale-95 transition-all mt-4 disabled:bg-gray-400 disabled:shadow-none mb-6"
                            >
                                {loading ? 'Submitting...' : 'Submit TA Voucher'}
                            </button>
                            <p className="text-[10px] text-gray-400 font-semibold text-center mt-2 italic">Status will update to: "Approved Pending for Admin and hr"</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Missed Punch Modal */}
            {showMissedPunch && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center px-4 overflow-hidden">
                    <div className="bg-white max-w-sm w-full rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Missed Punch</h3>
                        <p className="text-xs text-gray-500 mb-5">Submit a request to Admin/HR if you forgot to log your attendance.</p>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Punch Type</label>
                                <div className="flex bg-gray-100 rounded-lg p-1 w-full">
                                    <button
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${missedForm.type === 'in' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                                        onClick={() => setMissedForm({ ...missedForm, type: 'in' })}
                                    >In</button>
                                    <button
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${missedForm.type === 'out' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                                        onClick={() => setMissedForm({ ...missedForm, type: 'out' })}
                                    >Out</button>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Date</label>
                                    <input type="date" value={missedForm.date} onChange={e => setMissedForm({ ...missedForm, date: e.target.value })} className="w-full bg-gray-50 border border-gray-200 text-sm font-medium rounded-xl p-2.5 outline-none focus:border-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Time</label>
                                    <input type="time" value={missedForm.time} onChange={e => setMissedForm({ ...missedForm, time: e.target.value })} className="w-full bg-gray-50 border border-gray-200 text-sm font-medium rounded-xl p-2.5 outline-none focus:border-blue-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Reason</label>
                                <textarea value={missedForm.reason} onChange={e => setMissedForm({ ...missedForm, reason: e.target.value })} placeholder="e.g., Phone died, network issue" className="w-full bg-gray-50 border border-gray-200 text-sm font-medium rounded-xl p-3 h-20 outline-none focus:border-blue-400 resize-none"></textarea>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setShowMissedPunch(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 transition-all text-sm">Cancel</button>
                                <button onClick={submitMissedPunch} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-blue-500/30 disabled:opacity-50 text-sm">Submit</button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Confirm Punch Modal */}
            {
                showConfirmPunch && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center px-4 animate-fadeIn">
                        <div className="bg-white max-w-sm w-full rounded-3xl p-6 shadow-2xl text-center">
                            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${punchState === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm {punchState === 'in' ? 'Punch In' : 'Punch Out'}</h3>
                            <p className="text-sm text-gray-500 mb-6">Are you sure you want to mark your attendance ({punchState === 'in' ? 'Punch In' : 'Punch Out'}) right now?</p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowConfirmPunch(false)} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl active:scale-95 transition-all text-sm">Cancel</button>
                                <button onClick={confirmPunch} className={`flex-1 py-3.5 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md text-sm ${punchState === 'in' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}>Yes, {punchState === 'in' ? 'Punch In' : 'Punch Out'}</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default EAttandance;
