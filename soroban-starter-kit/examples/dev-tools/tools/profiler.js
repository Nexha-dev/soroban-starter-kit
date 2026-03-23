/**
 * profiler.js
 * Estimates compute units, fees, and storage costs for Soroban operations.
 * Based on Soroban fee model: https://soroban.stellar.org/docs/fundamentals-and-concepts/fees-and-metering
 */

const Profiler = (() => {

  // ── Fee constants (Soroban mainnet/testnet approximations) ─────────────────
  // Values based on Soroban protocol fee schedule
  const FEE = {
    BASE_FEE_STROOPS:        100,
    INCLUSION_FEE_STROOPS:   100,
    CPU_INSN_PER_UNIT:       10_000_000,   // instructions per compute unit
    MEM_BYTES_PER_UNIT:      40_960,       // bytes per memory unit
    LEDGER_READ_ENTRY:       6_250,        // stroops per ledger read entry
    LEDGER_WRITE_ENTRY:      10_000,       // stroops per ledger write entry
    LEDGER_READ_BYTE:        1_786,        // stroops per 1KB read
    LEDGER_WRITE_BYTE:       11_800,       // stroops per 1KB write
    EVENTS_BYTE:             3_000,        // stroops per 1KB events
    RENT_FEE_PER_ENTRY_LEDGER: 4_160,     // stroops per entry per ledger (persistent)
    STROOPS_PER_XLM:         10_000_000,
  };

  // ── Method cost profiles ───────────────────────────────────────────────────
  // Estimated based on typical simulation results (approximate)
  const METHOD_PROFILES = {
    token: {
      initialize:    { cpuUnits: 1_200_000, memUnits: 1_024, readEntries: 1, writeEntries: 4, readBytes: 256,  writeBytes: 512,  events: 64  },
      mint:          { cpuUnits: 1_800_000, memUnits: 1_536, readEntries: 2, writeEntries: 2, readBytes: 256,  writeBytes: 256,  events: 48  },
      burn:          { cpuUnits: 1_800_000, memUnits: 1_536, readEntries: 2, writeEntries: 2, readBytes: 256,  writeBytes: 256,  events: 48  },
      transfer:      { cpuUnits: 2_400_000, memUnits: 2_048, readEntries: 3, writeEntries: 2, readBytes: 384,  writeBytes: 256,  events: 64  },
      transfer_from: { cpuUnits: 2_800_000, memUnits: 2_560, readEntries: 4, writeEntries: 3, readBytes: 512,  writeBytes: 384,  events: 64  },
      approve:       { cpuUnits: 1_400_000, memUnits: 1_024, readEntries: 1, writeEntries: 1, readBytes: 128,  writeBytes: 128,  events: 48  },
      set_admin:     { cpuUnits: 1_200_000, memUnits: 1_024, readEntries: 1, writeEntries: 1, readBytes: 128,  writeBytes: 128,  events: 32  },
      balance:       { cpuUnits:   400_000, memUnits:   512, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
      allowance:     { cpuUnits:   400_000, memUnits:   512, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
      name:          { cpuUnits:   300_000, memUnits:   256, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
      symbol:        { cpuUnits:   300_000, memUnits:   256, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
      decimals:      { cpuUnits:   300_000, memUnits:   256, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
      total_supply:  { cpuUnits:   300_000, memUnits:   256, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
      admin:         { cpuUnits:   300_000, memUnits:   256, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
    },
    escrow: {
      initialize:      { cpuUnits: 1_500_000, memUnits: 1_536, readEntries: 1, writeEntries: 8, readBytes: 128,  writeBytes: 768,  events: 80  },
      fund:            { cpuUnits: 3_200_000, memUnits: 2_560, readEntries: 4, writeEntries: 2, readBytes: 512,  writeBytes: 256,  events: 64  },
      mark_delivered:  { cpuUnits: 1_600_000, memUnits: 1_536, readEntries: 2, writeEntries: 2, readBytes: 256,  writeBytes: 256,  events: 48  },
      approve_delivery:{ cpuUnits: 3_200_000, memUnits: 2_560, readEntries: 4, writeEntries: 2, readBytes: 512,  writeBytes: 256,  events: 64  },
      request_refund:  { cpuUnits: 3_000_000, memUnits: 2_048, readEntries: 3, writeEntries: 2, readBytes: 384,  writeBytes: 256,  events: 64  },
      resolve_dispute: { cpuUnits: 3_200_000, memUnits: 2_560, readEntries: 4, writeEntries: 2, readBytes: 512,  writeBytes: 256,  events: 64  },
      get_escrow_info: { cpuUnits:   600_000, memUnits:   512, readEntries: 7, writeEntries: 0, readBytes: 512,  writeBytes: 0,    events: 0   },
      get_state:       { cpuUnits:   300_000, memUnits:   256, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
      is_deadline_passed:{ cpuUnits: 300_000, memUnits:   256, readEntries: 1, writeEntries: 0, readBytes: 64,   writeBytes: 0,    events: 0   },
    },
  };

  // ── Storage cost estimator ─────────────────────────────────────────────────

  const STORAGE_RENT = {
    instance:   { ttlLedgers: 518_400, rentPerLedger: 0 },   // included in base fee
    persistent: { ttlLedgers: 0,       rentPerLedger: FEE.RENT_FEE_PER_ENTRY_LEDGER },
    temporary:  { ttlLedgers: 17_280,  rentPerLedger: 0 },   // auto-expires
  };

  function estimateOperation(contract, method) {
    const profile = METHOD_PROFILES[contract]?.[method];
    if (!profile) return null;

    const cpuFee    = Math.ceil((profile.cpuUnits / FEE.CPU_INSN_PER_UNIT) * 100);
    const memFee    = Math.ceil((profile.memUnits / FEE.MEM_BYTES_PER_UNIT) * 100);
    const readFee   = profile.readEntries  * FEE.LEDGER_READ_ENTRY  + Math.ceil(profile.readBytes  / 1024) * FEE.LEDGER_READ_BYTE;
    const writeFee  = profile.writeEntries * FEE.LEDGER_WRITE_ENTRY + Math.ceil(profile.writeBytes / 1024) * FEE.LEDGER_WRITE_BYTE;
    const eventFee  = Math.ceil(profile.events / 1024) * FEE.EVENTS_BYTE;
    const totalResource = cpuFee + memFee + readFee + writeFee + eventFee;
    const totalStroops  = FEE.BASE_FEE_STROOPS + FEE.INCLUSION_FEE_STROOPS + totalResource;
    const totalXlm      = totalStroops / FEE.STROOPS_PER_XLM;

    const cpuPct  = Math.min(100, Math.round(profile.cpuUnits / 100_000_000 * 100));
    const memPct  = Math.min(100, Math.round(profile.memUnits / 40_960 * 100));

    return {
      method,
      contract,
      profile,
      fees: { cpuFee, memFee, readFee, writeFee, eventFee, totalResource, totalStroops, totalXlm },
      utilization: { cpuPct, memPct },
      isReadOnly: profile.writeEntries === 0,
    };
  }

  function estimateStorage(storageType, entryCount, entrySize) {
    const writeFee  = entryCount * FEE.LEDGER_WRITE_ENTRY + Math.ceil((entryCount * entrySize) / 1024) * FEE.LEDGER_WRITE_BYTE;
    const readFee   = entryCount * FEE.LEDGER_READ_ENTRY  + Math.ceil((entryCount * entrySize) / 1024) * FEE.LEDGER_READ_BYTE;
    const rentInfo  = STORAGE_RENT[storageType];
    const rentFee   = storageType === 'persistent'
      ? entryCount * rentInfo.rentPerLedger * 100  // 100 ledger estimate
      : 0;

    return {
      storageType,
      entryCount,
      entrySize,
      totalBytes: entryCount * entrySize,
      writeFeeStroops: writeFee,
      readFeeStroops: readFee,
      rentFeeStroops: rentFee,
      totalStroops: writeFee + rentFee,
      totalXlm: (writeFee + rentFee) / FEE.STROOPS_PER_XLM,
      ttlNote: storageType === 'temporary'
        ? `Auto-expires after ~${rentInfo.ttlLedgers.toLocaleString()} ledgers (~1 day)`
        : storageType === 'instance'
        ? 'Tied to contract instance TTL'
        : 'Persistent — requires rent extension to keep alive',
    };
  }

  function getMethods(contract) {
    return Object.keys(METHOD_PROFILES[contract] || {});
  }

  return { estimateOperation, estimateStorage, getMethods };
})();
