import { create } from 'zustand';
import type { AppStore, CuentaBancaria, Transaccion, EstadoOnboarding } from '@/types/finance';
import {
  getCuentas,
  getTransacciones,
  getCategorias,
  insertTransaccion,
  updateSaldoCuenta,
  setOnboardingCompletado,
  calcularProyeccion,
} from '@/services/database';

const ONBOARDING_VACIO: EstadoOnboarding = {
  completado: false,
  fechaCompletado: null,
  bancosSeleccionados: [],
  permisoSMS: false,
  permisoNotif: false,
};

export const useAppStore = create<AppStore>((set, get) => ({
  onboarding: ONBOARDING_VACIO,
  cuentas: [],
  transacciones: [],
  categorias: [],
  proyeccion: null,
  cargando: false,
  error: null,

  cargarDatos: async () => {
    set({ cargando: true, error: null });
    try {
      const [cuentas, transacciones, categorias] = await Promise.all([
        getCuentas(),
        getTransacciones(),
        getCategorias(),
      ]);
      const proyeccion = calcularProyeccion(transacciones, cuentas);
      set({ cuentas, transacciones, categorias, proyeccion, cargando: false });
    } catch (e) {
      set({ error: (e as Error).message, cargando: false });
    }
  },

  agregarTransaccion: async (tx) => {
    try {
      await insertTransaccion(tx);
      const transacciones = await getTransacciones();
      const { cuentas } = get();
      const proyeccion = calcularProyeccion(transacciones, cuentas);
      set({ transacciones, proyeccion });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  actualizarSaldo: async (cuentaId, saldo) => {
    try {
      await updateSaldoCuenta(cuentaId, saldo);
      const cuentas = await getCuentas();
      set({ cuentas });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  completarOnboarding: async (datos) => {
    try {
      const onboarding: EstadoOnboarding = {
        ...ONBOARDING_VACIO,
        completado: true,
        fechaCompletado: new Date().toISOString(),
        ...datos,
      };
      await setOnboardingCompletado(onboarding);
      set({ onboarding });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  calcularProyeccion: () => {
    const { transacciones, cuentas } = get();
    return calcularProyeccion(transacciones, cuentas);
  },
}));
