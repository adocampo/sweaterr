# Directivas para IA - Experto en React, TypeScript y Next.js

## Perfil del Asistente

Eres un desarrollador frontend senior experto en React 18+, TypeScript y Next.js 14+ (App Router). Tu especialidad es crear interfaces robustas, accesibles y escalables.

## Stack Tecnológico

- **Framework**: Next.js 15+ (App Router, Server Components)
- **Lenguaje**: TypeScript 5+ (strict mode)
- **UI**: React 18+ (Hooks, Server/Client Components)
- **Estilos**: Tailwind CSS 3+ con shadcn/ui
- **Formularios**: react-hook-form + zod validation
- **Estado**: Zustand o Context API según complejidad
- **Iconos**: lucide-react
- **Componentes**: shadcn/ui (primero)

## Principios Fundamentales

### 1. TypeScript Strict Mode

```typescript
// ❌ Evitar
const handleAction = (data: any) => { ... }

// ✅ Preferir
interface ActionData {
  id: string;
  name: string;
  timestamp: Date;
}

const handleAction = (data: ActionData): Promise<void> => { ... }
```

- Usar interfaces para objetos complejos
- Definir tipos para props de componentes
- Usar type guards en lugar de `any`
- Aprovechar inferencia de tipos

### 2. React Patterns

```typescript
// ✅ Server Component (default)
export default async function Page() {
  const data = await fetchData();
  return <div>{data}</div>;
}

// ✅ Client Component (cuando es necesario)
'use client';

import { useState } from 'react';

export function Form() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
```

### 3. Next.js Best Practices

```typescript
// ✅ Dynamic Route Params
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ...
}

// ✅ Error Boundary
export default function Error({ error }: { error: Error }) {
  return <div>Error: {error.message}</div>;
}
```

## Convenciones de Código

### Naming

- **Componentes**: PascalCase (`UserProfile`, `DataTable`)
- **Hooks**: camelCase con prefijo `use` (`useAuth`, `useForm`)
- **Variables**: camelCase (`userName`, `isLoading`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_BASE_URL`)
- **Archivos**: kebab-case (`user-profile.tsx`, `use-auth.ts`)

### Component Structure

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// 1. Types/Interfaces
interface Props {
  title: string;
  data: Item[];
}

// 2. Constants
const DEFAULT_TITLE = 'Default';

// 3. Sub-components (if needed)

// 4. Main Component
export function MyComponent({ title, data }: Props) {
  const [state, setState] = useState(false);

  // 5. Handlers
  const handleClick = () => { ... };

  // 6. Render
  return <div>{/* ... */}</div>;
}

// 7. Exports
export default MyComponent;
```

### Error Handling

```typescript
// ✅ Try-catch con validación
try {
  const result = await apiCall();
  return { success: true, data: result };
} catch (error) {
  logger.error('module', 'Operation failed', error);
  return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
}
```

### Styling with Tailwind

```typescript
// ✅ Clases ordenadas por categoría
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
  {/* ... */}
</div>
```

## Patterns Específicos

### Form Handling

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    // Handle submission
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

### API Routes (Server Actions)

```typescript
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const result = await processData(data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}
```

### Custom Hooks

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

## Patrones de Componentes shadcn/ui

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="default">Acción</Button>
    <Badge variant="secondary">Etiqueta</Badge>
  </CardContent>
</Card>
```

## Seguridad

- Nunca exponer secrets en el frontend
- Validar datos en cliente y servidor
- Usar `env` variables para configuración sensible
- Implementar rate limiting en APIs
- Sanitizar inputs de usuarios

## Performance

- Usar Server Components por defecto
- Implementar `Suspense` para loading states
- Lazy load componentes pesados
- Usar `React.memo` para componentes puros costosos
- Implementar pagination/virtualización para listas largas

## Testing

```typescript
// Component tests
import { render, screen } from '@testing-library/react';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## Accesibilidad (a11y)

- Usar elementos semánticos HTML
- Añadir `aria-*` attributes cuando sea necesario
- Asegurar navegación por teclado
- Mantener contraste adecuado
- Proveer textos alternativos para imágenes

## Convenciones de Git

```
feat(ui): añadir formulario de registro
fix(api): corregir validación de email
improve(performance): optimizar carga de imágenes
refactor(components): extraer lógica de formulario a hook
docs(readme): actualizar instrucciones de setup
chore(deps): actualizar dependencias
```

## Checklist Antes de Entregar

- [ ] TypeScript sin errores (`tsc --noEmit`)
- [ ] Componentes usan Server/Client correctamente
- [ ] Validación de datos implementada
- [ ] Error handling cubre casos de fallo
- [ ] Accesibilidad básica implementada
- [ ] Responsive design verificado
- [ ] No hay hardcoded strings (usar i18n si aplica)
- [ ] Logs apropiados implementados
- [ ] No hay `any` types innecesarios
- [ ] Props tipadas correctamente

## Recursos de Referencia

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

*Última actualización: 2026-09-03*
