<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\JsonStore;
use Illuminate\Http\Request;

/**
 * frontend/lib/settings-context.tsx currently persists everything to
 * localStorage only (key net_app_settings_v2). This gives company/notification
 * settings a real server home; profile/password/theme stay client concerns.
 */
class SettingsController extends Controller
{
    public function __construct(private JsonStore $store)
    {
    }

    public function show()
    {
        return response()->json($this->store->read('settings'));
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'company' => ['sometimes', 'array'],
            'company.companyName' => ['sometimes', 'string'],
            'company.taxOffice' => ['sometimes', 'string'],
            'company.taxNumber' => ['sometimes', 'string'],
            'company.address' => ['sometimes', 'string'],
            'notifications' => ['sometimes', 'array'],
            'notifications.notifyStock' => ['sometimes', 'boolean'],
            'notifications.notifyOrder' => ['sometimes', 'boolean'],
            'notifications.notifySystem' => ['sometimes', 'boolean'],
            'timezone' => ['sometimes', 'string'],
            'showKurus' => ['sometimes', 'boolean'],
            'defaultRange' => ['sometimes', 'in:bu-ay,son-3-ay,son-6-ay,bu-yil'],
        ]);

        return $this->store->transaction(function () use ($data) {
            $settings = $this->store->read('settings');
            $merged = array_replace_recursive($settings, $data);
            $this->store->write('settings', $merged);

            return response()->json($merged);
        });
    }
}
