import { useState, useRef, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

const PW = "jera8888"

const vertexShader = `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 pos = position;
  float d = sin(pos.x*2.0+uTime*0.5) *
            cos(pos.y*1.8+uTime*0.4) *
            sin(pos.z*2.0+uTime*0.6) * 0.22;
  pos += normal * d;
  vNormal = normal;
  vPosition = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 pink  = vec3(1.0,  0.65, 0.75);
  vec3 blue  = vec3(0.45, 0.75, 1.0);
  vec3 mint  = vec3(0.55, 0.95, 0.80);
  vec3 peach = vec3(1.0,  0.80, 0.60);
  vec3 lilac = vec3(0.80, 0.70, 1.0);
  vec3 cyan  = vec3(0.50, 0.90, 1.0);

  float t1 = sin(vPosition.x*1.5+uTime*0.4)*0.5+0.5;
  float t2 = cos(vPosition.y*1.8+uTime*0.35)*0.5+0.5;
  float t3 = sin(vPosition.z*1.6+uTime*0.5)*0.5+0.5;
  float t4 = cos((vPosition.x+vPosition.y)*1.2+uTime*0.3)*0.5+0.5;

  vec3 col = mix(pink, blue, t1);
  col = mix(col, mint, t2*0.6);
  col = mix(col, peach, t3*0.5);
  col = mix(col, lilac, t4*0.3);
  col = mix(col, cyan, sin(uTime*0.2)*0.25+0.25);

  float fresnel = pow(1.0-abs(dot(normalize(vNormal),vec3(0,0,1))),2.0);
  col += fresnel*0.3;

  gl_FragColor = vec4(col, 0.88);
}
`

function Blob() {
  const meshRef = useRef()
  const mouse = useRef({ x: 0, y: 0 })
  const target = useRef({ x: 0, y: 0 })

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const geo = useMemo(() => new THREE.IcosahedronGeometry(2.0, 20), [])

  useEffect(() => {
    const onMove = e => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime
    uniforms.uTime.value = t
    target.current.y += (mouse.current.x * 0.42 - target.current.y) * 0.0525
    target.current.x += (mouse.current.y * 0.42 - target.current.x) * 0.0525
    meshRef.current.rotation.y = target.current.y + t * 0.0033
    meshRef.current.rotation.x = target.current.x + t * 0.0011
    meshRef.current.position.y = Math.sin(t * 0.55) * 0.198
  })

  return (
    <mesh ref={meshRef} geometry={geo}>
      <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} transparent />
    </mesh>
  )
}

function LoginPopup({ onClose, onAuth }) {
  const [pw, setPw] = useState("")
  const [error, setError] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const h = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  const submit = () => {
    if (pw === PW) { onAuth(); onClose() }
    else { setError(true); setPw("") }
  }

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",
      backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",
      zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#FFFFFF",borderRadius:12,padding:"48px 40px",width:360,
        textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.15)",
      }}>
        <p style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:700,color:"#1A1714",letterSpacing:"-.5px"}}>IKU ERP</p>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:12,color:"#9A9590",letterSpacing:"2px",marginTop:8,marginBottom:32}}>대시보드 접속</p>

        <label style={{display:"block",fontSize:9,color:"#9A9590",letterSpacing:"3px",textAlign:"left",marginBottom:6,fontWeight:500}}>PASSWORD</label>
        <input ref={inputRef} type="password" value={pw}
          onChange={e=>{setPw(e.target.value);setError(false)}}
          onKeyDown={e=>{if(e.key==="Enter")submit()}}
          placeholder="· · · · · · · ·"
          style={{
            width:"100%",padding:"12px 16px",border:`1px solid ${error?"#B85252":"#E2DDD6"}`,
            borderRadius:6,fontSize:16,textAlign:"center",letterSpacing:"4px",
            outline:"none",background:"transparent",color:"#1A1714",transition:"border-color .2s",
          }}
          onFocus={e=>{e.target.style.borderColor="#C9A86E"}}
          onBlur={e=>{e.target.style.borderColor=error?"#B85252":"#E2DDD6"}}
        />
        {error && <p style={{fontSize:12,color:"#B85252",marginTop:8,fontWeight:500}}>비밀번호가 올바르지 않습니다</p>}

        <button onClick={submit} style={{
          width:"100%",padding:14,marginTop:16,background:"#1A1714",color:"#F5F2EC",
          border:"none",borderRadius:6,fontSize:14,fontWeight:500,letterSpacing:"2px",
          transition:"all .2s cubic-bezier(0.34,1.56,0.64,1)",cursor:"pointer",
        }}
          onMouseEnter={e=>{e.currentTarget.style.background="#C9A86E";e.currentTarget.style.color="#1A1714"}}
          onMouseLeave={e=>{e.currentTarget.style.background="#1A1714";e.currentTarget.style.color="#F5F2EC"}}>
          입장하기 →
        </button>
      </div>
    </div>
  )
}

export default function CoverPage({ onEnter }) {
  const [showLogin, setShowLogin] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "auto" }
  }, [])

  const handleAuth = () => {
    setAuthed(true)
    try { sessionStorage.setItem("iku_auth", "1") } catch {}
    setTimeout(() => { onEnter() }, 1500)
  }

  return (
    <div style={{position:"relative",width:"100%",height:"100vh",background:"#F5F2EC",overflow:"hidden",fontFamily:"'Space Grotesk','Plus Jakarta Sans',system-ui,sans-serif"}}>

      <style>{`
        @keyframes pulse {
          0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(26,23,20,0.3); }
          50% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(26,23,20,0); }
        }
      `}</style>

      <div style={{position:"fixed",top:0,left:0,right:0,zIndex:30,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 32px"}}>
        <span style={{fontSize:10,fontWeight:400,color:"#9A9590",letterSpacing:"3px"}}>SYS.IO · IKU—OPS</span>
        <span style={{fontSize:10,fontWeight:400,color:"#9A9590",letterSpacing:"3px"}}>01 HOME · 02 생산 · 03 판매 · 04 TERMINAL</span>
      </div>

      <div style={{position:"absolute",inset:0,zIndex:1}}>
        <Canvas camera={{position:[0,0,5.5],fov:45}} gl={{alpha:true,antialias:true}} style={{background:"transparent"}}>
          <ambientLight intensity={0.5}/>
          <Blob/>
        </Canvas>
      </div>

      <div style={{position:"absolute",inset:0,zIndex:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
        <div style={{
          fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,
          fontSize:"7.5vw",
          lineHeight:0.95,
          textAlign:"center",
          color:"#FFFFFF",letterSpacing:"-0.01em",
          textShadow:"1px 1px 0px rgba(0,0,0,0.15), 2px 2px 4px rgba(0,0,0,0.08)",
          mixBlendMode:"overlay",
          userSelect:"none",
        }}>
          <div>IKU ERP</div>
          <div>DASHBOARD</div>
        </div>

        <div style={{marginTop:32,pointerEvents:"auto"}}>
          {authed ? (
            <div style={{
              fontSize:16,fontWeight:600,color:"#1A1714",letterSpacing:"4px",padding:"18px 48px",
              background:"#C9A86E",borderRadius:3,border:"2px solid #9A7228",
              boxShadow:"0 4px 20px rgba(201,168,110,0.5)",
              cursor:"default",pointerEvents:"none",
            }}>
              ✓ 인증완료
            </div>
          ) : (
            <button onClick={()=>setShowLogin(true)} style={{
              fontSize:18,fontWeight:500,letterSpacing:"6px",padding:"18px 64px",
              background:"#1A1714",color:"#F5F2EC",border:"none",borderRadius:3,
              animation:"pulse 2.5s ease-in-out infinite",
              transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)",cursor:"pointer",
            }}
              onMouseEnter={e=>{e.currentTarget.style.background="#C9A86E";e.currentTarget.style.color="#1A1714";e.currentTarget.style.transform="translateX(4px) scale(1.04)";e.currentTarget.style.boxShadow="0 8px 32px rgba(201,168,110,0.45)";e.currentTarget.style.animation="none"}}
              onMouseLeave={e=>{e.currentTarget.style.background="#1A1714";e.currentTarget.style.color="#F5F2EC";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";e.currentTarget.style.animation="pulse 2.5s ease-in-out infinite"}}
            >ENTER →</button>
          )}
        </div>
      </div>

      <div style={{position:"absolute",bottom:32,left:32,zIndex:20,display:"flex",flexDirection:"column",gap:6}}>
        <span style={{fontSize:8,color:"#9A9590",letterSpacing:"3px",fontWeight:500}}>OBJECTIVE</span>
        <span style={{fontSize:12,color:"#8A8278"}}>의류 생산·판매 통합 운영 플랫폼.</span>
        <span style={{fontSize:8,color:"#9A9590",letterSpacing:"3px",fontWeight:500,marginTop:8}}>PROTOCOL</span>
        <span style={{fontSize:11,color:"#1A1714",fontWeight:500}}>IKU-OPS-2026</span>
      </div>

      <div style={{position:"absolute",bottom:32,right:32,zIndex:20}}>
        <span style={{fontSize:8,color:"#9A9590",letterSpacing:"3px"}}>© IKU ERP 2026</span>
      </div>

      {showLogin && <LoginPopup onClose={()=>setShowLogin(false)} onAuth={handleAuth}/>}
    </div>
  )
}
