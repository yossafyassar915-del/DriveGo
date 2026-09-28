/* ===== mockData: البيانات الابتدائية (تُحقن في localStorage عند أول تشغيل فقط) ===== */
const mockData = {
  cars: [
    { id: 1, name: 'Toyota Camry', cat: 'Sedan', gear: 'Automatic', price: 220, seats: 5, img: '🚗', available: true },
    { id: 2, name: 'Hyundai Elantra', cat: 'Sedan', gear: 'Manual', price: 150, seats: 5, img: '🚙', available: true },
    { id: 3, name: 'Honda Accord', cat: 'Sedan', gear: 'Automatic', price: 260, seats: 5, img: '🚘', available: true },
    { id: 4, name: 'Toyota Land Cruiser', cat: 'SUV', gear: 'Automatic', price: 480, seats: 7, img: '🚙', available: true },
    { id: 5, name: 'Kia Sportage', cat: 'SUV', gear: 'Automatic', price: 280, seats: 5, img: '🚙', available: true },
    { id: 6, name: 'Nissan Patrol', cat: 'SUV', gear: 'Manual', price: 420, seats: 7, img: '🚐', available: true },
    { id: 7, name: 'Tesla Model 3', cat: 'Electric', gear: 'Automatic', price: 390, seats: 5, img: '⚡', available: true },
    { id: 8, name: 'Hyundai Ioniq 5', cat: 'Electric', gear: 'Automatic', price: 350, seats: 5, img: '🔋', available: true }
  ],
  users: [
    { id: 1, name: 'سارة العتيبي', email: 'sara@demo.com', role: 'customer' },
    { id: 2, name: 'خالد الحربي', email: 'khaled@demo.com', role: 'customer' },
    { id: 3, name: 'ماجد السائق', email: 'majed@drivego.com', role: 'driver' },
    { id: 4, name: 'المدير العام', email: 'admin@drivego.com', role: 'admin' }
  ],
  contracts: [
    { id: 101, userId: 1, userName: 'سارة العتيبي', carId: 1, carName: 'Toyota Camry', from: '2026-09-25', to: '2026-09-30', days: 5, pickup: 'مطار الملك خالد', dropoff: 'وسط الرياض', extras: ['gps'], total: 1200, status: 'active' },
    { id: 102, userId: 1, userName: 'سارة العتيبي', carId: 7, carName: 'Tesla Model 3', from: '2026-10-10', to: '2026-10-17', days: 7, pickup: 'وسط الرياض', dropoff: 'وسط الرياض', extras: ['insurance'], total: 2660, status: 'upcoming' },
    { id: 103, userId: 1, userName: 'سارة العتيبي', carId: 5, carName: 'Kia Sportage', from: '2026-08-01', to: '2026-08-04', days: 3, pickup: 'مطار جدة', dropoff: 'كورنيش جدة', extras: [], total: 840, status: 'completed' },
    { id: 104, userId: 2, userName: 'خالد الحربي', carId: 4, carName: 'Toyota Land Cruiser', from: '2026-09-20', to: '2026-09-29', days: 9, pickup: 'مطار جدة', dropoff: 'مطار جدة', extras: ['insurance', 'childSeat'], total: 4700, status: 'active' },
    { id: 105, userId: 2, userName: 'خالد الحربي', carId: 2, carName: 'Hyundai Elantra', from: '2026-07-05', to: '2026-07-08', days: 3, pickup: 'الدمام - الواجهة', dropoff: 'الدمام - الواجهة', extras: [], total: 450, status: 'completed' },
    { id: 106, userId: 2, userName: 'خالد الحربي', carId: 3, carName: 'Honda Accord', from: '2026-06-01', to: '2026-06-03', days: 2, pickup: 'وسط الرياض', dropoff: 'مطار الملك خالد', extras: ['gps'], total: 560, status: 'cancelled' }
  ],
  tasks: [
    { id: 201, driverId: 3, type: 'توصيل', car: 'Toyota Camry', customer: 'سارة العتيبي', place: 'مطار الملك خالد', date: '2026-09-25', done: true },
    { id: 202, driverId: 3, type: 'توصيل', car: 'Tesla Model 3', customer: 'سارة العتيبي', place: 'وسط الرياض', date: '2026-10-10', done: false },
    { id: 203, driverId: 3, type: 'استلام', car: 'Toyota Land Cruiser', customer: 'خالد الحربي', place: 'مطار جدة', date: '2026-09-29', done: false },
    { id: 204, driverId: 3, type: 'استلام', car: 'Toyota Camry', customer: 'سارة العتيبي', place: 'وسط الرياض', date: '2026-09-30', done: false }
  ]
};

/* ===== المحفظة والإشعارات ===== */
mockData.txs = [
  { id: 301, userId: 1, via: 'wallet', amount: 3000, note: 'شحن رصيد', date: '2026-08-01' },
  { id: 302, userId: 1, via: 'wallet', amount: -1200, note: 'دفع عقد Toyota Camry', date: '2026-09-24' },
  { id: 303, userId: 2, via: 'wallet', amount: 5000, note: 'شحن رصيد', date: '2026-09-01' },
  { id: 304, userId: 2, via: 'card', amount: -4700, note: 'دفع عقد Land Cruiser', date: '2026-09-19' }
];
mockData.notifs = [
  { id: 401, userId: 1, text: 'مرحباً بك في DriveGo 👋', read: false, time: '09:00' },
  { id: 402, userId: 3, text: 'مهمة توصيل جديدة: Tesla Model 3', read: false, time: '10:15' }
];
