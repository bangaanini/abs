import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const OPSI_ABSEN = ['0','0,5 hari','1 hari','1,5 hari','2 hari','1 hari 2 jam'];

export default function Home() {
  const [nama, setNama] = useState('');
  const [job, setJob] = useState('tukang');
  const [pekerja, setPekerja] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data } = await supabase.from('workers').select('*');
    setPekerja(data || []);
  }

  async function addWorker() {
    if (!nama) return;
    await supabase.from('workers').insert({ nama, job });
    setNama('');
    setJob('tukang');
    fetchData();
  }

  async function updateAttendance(workerId, hari, value) {
    await supabase.from('attendance').upsert({ worker_id: workerId, hari, value });
    fetchData();
  }

  function hitungTotal(attendance, job) {
    let totalHari = 0;
    let extraJam = 0;
    attendance.forEach((a) => {
      switch (a.value) {
        case '0,5 hari': totalHari += 0.5; break;
        case '1 hari': totalHari += 1; break;
        case '1,5 hari': totalHari += 1.5; break;
        case '2 hari': totalHari += 2; break;
        case '1 hari 2 jam': totalHari += 1; extraJam += 2; break;
      }
    });
    const gajiHarian = job === 'tukang' ? 100000 : 90000;
    const gajiPer2Jam = job === 'tukang' ? 30000 : 20000;
    return {
      totalHari,
      gaji: (totalHari * gajiHarian) + (extraJam/2 * gajiPer2Jam)
    };
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Absensi Kerja Proyek</h1>
      <div className="mb-6 flex gap-2">
        <input
          className="border p-2"
          placeholder="Nama Pekerja"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
        />
        <select className="border p-2" value={job} onChange={(e) => setJob(e.target.value)}>
          <option value="tukang">Tukang</option>
          <option value="tenaga">Tenaga</option>
        </select>
        <button onClick={addWorker} className="bg-blue-600 text-white px-4 py-2 rounded">Tambah</button>
      </div>

      <table className="table-auto border-collapse border w-full text-sm">
        <thead>
          <tr>
            <th className="border px-2 py-1">Nama</th>
            <th className="border px-2 py-1">Job</th>
            {HARI.map(h => <th key={h} className="border px-2 py-1">{h}</th>)}
            <th className="border px-2 py-1">Total Hari</th>
            <th className="border px-2 py-1">Gaji</th>
          </tr>
        </thead>
        <tbody>
          {pekerja.map((p) => {
            const { attendance = [] } = p;
            const { totalHari, gaji } = hitungTotal(attendance, p.job);
            return (
              <tr key={p.id}>
                <td className="border px-2 py-1">{p.nama}</td>
                <td className="border px-2 py-1 capitalize">{p.job}</td>
                {HARI.map((h) => {
                  const val = attendance.find(a => a.hari === h)?.value || '0';
                  return (
                    <td key={h} className="border px-2 py-1">
                      <select
                        value={val}
                        onChange={(e) => updateAttendance(p.id, h, e.target.value)}
                      >
                        {OPSI_ABSEN.map(opt => <option key={opt}>{opt}</option>)}
                      </select>
                    </td>
                  );
                })}
                <td className="border px-2 py-1 text-center">{totalHari}</td>
                <td className="border px-2 py-1 text-center">Rp {gaji.toLocaleString('id-ID')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}