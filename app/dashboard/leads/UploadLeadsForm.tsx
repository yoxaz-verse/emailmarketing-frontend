'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { uploadLeadsAction } from './actions';

type Lead = {
  email: string;
  first_name: string;
  company: string;
  country: string;
  phone?: string;
  company_description?: string;
};

export default function UploadLeadsForm({
  role,
  operators
}: {
  role?: string;
  operators: any[];
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [operatorId, setOperatorId] = useState<string>('');

  const [form, setForm] = useState<Lead>({
    email: '',
    first_name: '',
    company: '',
    country: '',
    phone: '',
    company_description: ''
  });

  function isValidLead(l: Lead) {
    return l.email && l.first_name && l.company && l.country;
  }

  function addManualLead() {
    if (!isValidLead(form)) return alert('Missing required fields');
    setLeads((p) => [...p, form]);
    setForm({
      email: '',
      first_name: '',
      company: '',
      country: '',
      phone: '',
      company_description: ''
    });
  }

  function handleCSV(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const parsed = (r.data as any[])
          .map((row) => ({
            email: row.email?.trim(),
            first_name: row.first_name?.trim(),
            company: row.company?.trim(),
            country: row.country?.trim(),
            phone: row.phone?.trim(),
            company_description: row.company_description?.trim()
          }))
          .filter(isValidLead);

        setLeads((p) => [...p, ...parsed]);
      }
    });
  }

  async function submit() {
    await uploadLeadsAction(
      leads,
      role === 'admin' ? operatorId : undefined
    );
    setLeads([]);
    alert('Leads uploaded');
  }

  return (
    <div className="space-y-6">
      {role === 'admin' && (
        <select
          className="border p-2 rounded"
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
        >
          <option value="">Select operator</option>
          {operators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.name} ({op.region})
            </option>
          ))}
        </select>
      )}

      <Input
        placeholder="Email *"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      <Input
        placeholder="First Name *"
        value={form.first_name}
        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
      />

      <Input
        placeholder="Company *"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
      />

      <Input
        placeholder="Country *"
        value={form.country}
        onChange={(e) => setForm({ ...form, country: e.target.value })}
      />

      <Input
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />

      <Textarea
        placeholder="Company description"
        value={form.company_description}
        onChange={(e) =>
          setForm({ ...form, company_description: e.target.value })
        }
      />

      <Button onClick={addManualLead}>Add Lead</Button>

      <Input
        type="file"
        accept=".csv"
        onChange={(e) => e.target.files && handleCSV(e.target.files[0])}
      />

      {leads.length > 0 && (
        <pre className="text-xs bg-white p-3 border rounded">
          {JSON.stringify(leads, null, 2)}
        </pre>
      )}

      <Button disabled={!leads.length} onClick={submit}>
        Upload {leads.length} Leads
      </Button>
    </div>
  );
}
