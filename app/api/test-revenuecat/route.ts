import { NextResponse } from 'next/server';

const REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v2';
const REVENUECAT_API_KEY = (process.env.REVENUECAT_API_KEY || '').trim();
const REVENUECAT_PROJECT_ID = (process.env.REVENUECAT_PROJECT_ID || '').trim();

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    credentials: {
      hasApiKey: !!REVENUECAT_API_KEY,
      hasProjectId: !!REVENUECAT_PROJECT_ID,
      apiKeyPrefix: REVENUECAT_API_KEY ? REVENUECAT_API_KEY.slice(0, 10) + '...' : null,
      projectIdPrefix: REVENUECAT_PROJECT_ID ? REVENUECAT_PROJECT_ID.slice(0, 10) + '...' : null,
    },
    tests: {},
  };

  if (!REVENUECAT_API_KEY || !REVENUECAT_PROJECT_ID) {
    return NextResponse.json({
      ...results,
      error: 'Missing credentials',
    }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${REVENUECAT_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Overview API
  try {
    const overviewRes = await fetch(
      `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/metrics/overview`,
      { headers, cache: 'no-store' }
    );

    results.tests.overview = {
      status: overviewRes.status,
      ok: overviewRes.ok,
    };

    if (overviewRes.ok) {
      const data = await overviewRes.json();
      results.tests.overview.data = {
        keys: Object.keys(data),
        hasMetrics: Array.isArray(data.metrics),
        metricsCount: data.metrics?.length || 0,
        sampleMetrics: data.metrics?.slice(0, 3)?.map((m: any) => ({ id: m.id, value: m.value })),
      };
      
      // Find specific metrics
      if (Array.isArray(data.metrics)) {
        const findMetric = (id: string) => data.metrics.find((m: any) => m.id === id);
        results.tests.overview.parsed = {
          mrr: findMetric('mrr')?.value ?? 'NOT_FOUND',
          revenue: findMetric('revenue')?.value ?? 'NOT_FOUND',
          totalRevenue: findMetric('total_revenue')?.value ?? 'NOT_FOUND',
          activeSubscriptions: findMetric('active_subscriptions')?.value ?? 'NOT_FOUND',
          activeTrials: findMetric('active_trials')?.value ?? 'NOT_FOUND',
          trialConversions: findMetric('trial_conversions')?.value ?? 'NOT_FOUND',
          churnRate: findMetric('churn_rate')?.value ?? 'NOT_FOUND',
        };
      }
    } else {
      results.tests.overview.error = await overviewRes.text();
    }
  } catch (error) {
    results.tests.overview = { error: String(error) };
  }

  // Test 2: Charts Revenue API
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const chartsRes = await fetch(
      `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/charts/revenue?start_date=${thirtyDaysAgo}&end_date=${today}&resolution=day`,
      { headers, cache: 'no-store' }
    );

    results.tests.chartsRevenue = {
      status: chartsRes.status,
      ok: chartsRes.ok,
    };

    if (chartsRes.ok) {
      const data = await chartsRes.json();
      results.tests.chartsRevenue.data = {
        keys: Object.keys(data),
      };
    } else {
      results.tests.chartsRevenue.error = await chartsRes.text();
    }
  } catch (error) {
    results.tests.chartsRevenue = { error: String(error) };
  }

  // Test 3: Events API (for purchase data)
  try {
    const eventsRes = await fetch(
      `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/events?limit=10`,
      { headers, cache: 'no-store' }
    );

    results.tests.events = {
      status: eventsRes.status,
      ok: eventsRes.ok,
    };

    if (eventsRes.ok) {
      const data = await eventsRes.json();
      results.tests.events.data = {
        keys: Object.keys(data),
        hasItems: Array.isArray(data.items),
        itemsCount: data.items?.length || 0,
        sampleEventTypes: data.items?.slice(0, 3)?.map((e: any) => e.type),
      };
    } else {
      results.tests.events.error = await eventsRes.text();
    }
  } catch (error) {
    results.tests.events = { error: String(error) };
  }

  // Test 4: Customers API (for subscriber data)
  try {
    const customersRes = await fetch(
      `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/customers?limit=10`,
      { headers, cache: 'no-store' }
    );

    results.tests.customers = {
      status: customersRes.status,
      ok: customersRes.ok,
    };

    if (customersRes.ok) {
      const data = await customersRes.json();
      results.tests.customers.data = {
        keys: Object.keys(data),
        hasItems: Array.isArray(data.items),
        itemsCount: data.items?.length || 0,
        sampleCustomer: data.items?.[0] ? {
          id: data.items[0].id,
          hasEntitlements: !!data.items[0].entitlements,
          entitlementCount: Object.keys(data.items[0].entitlements || {}).length,
        } : null,
      };
    } else {
      results.tests.customers.error = await customersRes.text();
    }
  } catch (error) {
    results.tests.customers = { error: String(error) };
  }

  // Test 5: Subscriptions API for a customer
  try {
    const customersRes = await fetch(
      `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/customers?limit=1`,
      { headers, cache: 'no-store' }
    );
    
    if (customersRes.ok) {
      const customersData = await customersRes.json();
      const customerId = customersData.items?.[0]?.id;
      
      if (customerId) {
        const subsRes = await fetch(
          `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(customerId)}/subscriptions`,
          { headers, cache: 'no-store' }
        );

        results.tests.subscriptions = {
          status: subsRes.status,
          ok: subsRes.ok,
        };

        if (subsRes.ok) {
          const data = await subsRes.json();
          results.tests.subscriptions.data = {
            keys: Object.keys(data),
            hasItems: Array.isArray(data.items),
            itemsCount: data.items?.length || 0,
          };
        } else {
          results.tests.subscriptions.error = await subsRes.text();
        }
      }
    }
  } catch (error) {
    results.tests.subscriptions = { error: String(error) };
  }

  // Test 6: Transactions API (backup)
  try {
    const txRes = await fetch(
      `${REVENUECAT_BASE_URL}/projects/${REVENUECAT_PROJECT_ID}/transactions`,
      { headers, cache: 'no-store' }
    );

    results.tests.transactions = {
      status: txRes.status,
      ok: txRes.ok,
    };

    if (txRes.ok) {
      const data = await txRes.json();
      results.tests.transactions.data = {
        keys: Object.keys(data),
        hasItems: Array.isArray(data.items),
        itemsCount: data.items?.length || 0,
      };
    } else {
      results.tests.transactions.error = await txRes.text();
    }
  } catch (error) {
    results.tests.transactions = { error: String(error) };
  }

  return NextResponse.json(results);
}
