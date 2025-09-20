import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday']

// opsi yang diminta: 0, 0.5 hari, 1 hari, 1.5 hari, 2 hari, 1 hari 2 jam
const OPTIONS = [
  { label: '0', value: '0' },
  { label: '0,5 hari', value: '0.5' },
  { label: '1 hari', value: '1' },
  { label: '1,5 hari', value: '1.5' },
  { label: '2 hari', value: '2' },
  { label: '1 hari 2 jam', value: '1+2h' }
]

export default function Home() {
  const [name, setName] = useState('')
  const [job, setJob] = useState('tukang')
  const [workers, setWorkers] = useState([])
  const [attendanceMap, setAttendanceMap] = useState({}) // key: workerId_weekStart -> data
  const [weekStart, setWeekStart] = useState(getMonday(new Date()))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchWorkers()
    fetchAttendances()
  }, [weekStart])

  async function fetchWorkers(){
    const { data, error } = await supabase.from('workers').select('*').order('id', {ascending:true})
    if(error) return console.error(error)
    setWorkers(data)
  }

  async function fetchAttendances(){
    const { data, error } = await supabase.from('attendance')
      .select('*')
      .eq('week_start_date', formatDate(weekStart))
    if(error) return console.error(error)
    const map = {}
    (data||[]).forEach(row => {
      map[`${row.worker_id}_${row.week_start_date}`] = row
    })
    setAttendanceMap(map)
  }

  async function addWorker(e){
    e.preventDefault()
    if(!name.trim()) return alert('Nama harus diisi')
    setLoading(true)
    const { data, error } = await supabase.from('workers').insert([{ name: name.trim(), job }]).select().single()
    if(error){ setLoading(false); return alert('Error: '+error.message) }
    // tambahkan attendance default untuk minggu ini
    const defaultData = {}
    DAYS.forEach(d=> defaultData[d] = '0')
    await supabase.from('attendance').upsert({ worker_id: data.id, week_start_date: formatDate(weekStart), data: defaultData })
    setName('')
    fetchWorkers()
    fetchAttendances()
    setLoading(false)
  }

  // simpan perubahan attendance ke supabase
  async function saveAttendance(workerId, day, value){
    const key = `${workerId}_${formatDate(weekStart)}`
    const existing = attendanceMap[key]
    const newData = existing ? {...existing.data} : {}
    newData[day] = value
    setAttendanceMap(prev => ({...prev, [key]: {...existing, data: newData, worker_id: workerId, week_start_date: formatDate(weekStart)} }))

    // upsert
    const payload = { worker_id: workerId, week_start_date: formatDate(weekStart), data: newData }
    const { error } = await supabase.from('attendance').upsert(payload)
    if(error) console.error('saveAttendance error', error)
  }

  function calcTotalsFromData(data, job){
    // data: object monday..saturday -> option value
    // returns { totalDays, totalHours, salary }
    let totalDays = 0
    let totalHours = 0
    for(const d of DAYS){
      const v = data?.[d] || '0'
      if(v === '1+2h'){
        totalDays += 1
        totalHours += 2
      } else {
        // decimal day values like 0.5,1,1.5,2
        const num = parseFloat(v)
        if(!isNaN(num)){
          // if fractional part .5 is in days -> convert remainder to hours? user requested total hari dan jam
          const whole = Math.floor(num)
          const frac = num - whole
          totalDays += whole
          if(Math.abs(frac - 0.5) < 0.001){
            totalDays += 0.5
          }
        }
      }
    }

    // Convert .5 day to hours for "total hours" column? The user asked total jumlah hari dan jam masuk.
    // We'll compute "total hari" as integer + halves (e.g. 3.5), and "total jam" as extra hours (from 1+2h options only).

    // salary calculation
    const dayRate = job === 'tukang' ? 100000 : 90000
    const twoHourRate = job === 'tukang' ? 30000 : 20000

    // Count days including halves from values
    let salary = 0
    for(const d of DAYS){
      const v = data?.[d] || '0'
      if(v === '1+2h'){
        salary += dayRate
        salary += twoHourRate
      } else {
        const num = parseFloat(v)
        if(!isNaN(num)){
          salary += num * dayRate
        }
      }
    }

    // totalHours only from 1+2h entries
    // If user wants separate "hours" column for halves, we consider halves as days (not hours) per spec.

    // count total hours from '1+2h' occurrences
    let hours = 0
    for(const d of DAYS){
      if((data?.[d]||'0') === '1+2h') hours += 2
    }

    return { totalDays: sumDays(data), totalHours: hours, salary }
  }

  function sumDays(data){
    let t=0
    for(const d of DAYS){
      const v = data?.[d] || '0'
      if(v === '1+2h') t += 1
      else {
        const num = parseFloat(v)
        if(!isNaN(num)) t += num
      }
    }
    return t
  }

  function prevWeek(){
    const d = new Date(weekStart)
    d.setDate(d.getDate()-7)
    setWeekStart(getMonday(d))
  }
  function nextWeek(){
    const d = new Date(weekStart)
    d.setDate(d.getDate()+7)
    setWeekStart(getMonday(d))
  }

  return (
    <div className="container">
      <h1>Absensi Proyek (Minggu {formatDate(weekStart)})</h1>
      <div className="controls">
        <button onClick={prevWeek}>‹ Minggu sebelumnya</button>
        <button onClick={nextWeek}>Minggu berikut</button>
      </div>

      <section className="card">
        <h2>Tambah Pekerja</h2>
        <form onSubmit={addWorker} className="form">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama pekerja" />
          <select value={job} onChange={e=>setJob(e.target.value)}>
            <option value="tukang">Tukang (Rp 100.000/hari)</option>
            <option value="tenaga">Tenaga (Rp 90.000/hari)</option>
          </select>
          <button type="submit" disabled={loading}>{loading ? 'Menyimpan...' : 'Tambah'}</button>
        </form>
      </section>

      <section className="card">
        <h2>Daftar & Absensi</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Job</th>
                {DAYS.map(d=>(<th key={d}>{capitalize(d)}</th>))}
                <th>Total Hari</th>
                <th>Total Jam</th>
                <th>Gaji (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(w=>{
                const key = `${w.id}_${formatDate(weekStart)}`
                const row = attendanceMap[key]
                const data = row ? row.data : (function(){ const dd={}; DAYS.forEach(d=> dd[d]='0'); return dd})()
                const totals = calcTotalsFromData(data, w.job)
                return (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td>{w.job}</td>
                    {DAYS.map(day=> (
                      <td key={day}>
                        <select value={data?.[day]||'0'} onChange={e=> saveAttendance(w.id, day, e.target.value)}>
                          {OPTIONS.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                    ))}
                    <td>{totals.totalDays}</td>
                    <td>{totals.totalHours}</td>
                    <td>{formatCurrency(totals.salary)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer style={{marginTop:20,fontSize:12}}>
        * Kalkulasi: 1 hari tenaga 90.000 | 1 hari tukang 100.000. 2 jam tenaga 20.000 | 2 jam tukang 30.000. 0,5 hari dihitung sebagai setengah dari tarif harian.
      </footer>
    </div>
  )
}

// helper functions
function capitalize(s){ return s[0].toUpperCase()+s.slice(1) }
function formatCurrency(n){ return n?.toLocaleString('id-ID') || '0' }

function formatDate(d){
  const dt = new Date(d)
  return dt.toISOString().slice(0,10)
}

function getMonday(d){
  // return date object for monday of week containing d
  const date = new Date(d)
  const day = date.getDay() || 7
  if(day !== 1) date.setHours(-24 * (day - 1))
  date.setHours(0,0,0,0)
  return new Date(date)
                                                                    }
