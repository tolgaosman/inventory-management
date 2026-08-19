<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;

class ExportPostman extends Command
{
    protected $signature = 'export:postman';
    protected $description = 'Export API routes to a Postman collection';

    public function handle()
    {
        $routes = Route::getRoutes();
        $items = [];

        foreach ($routes as $route) {
            $uri = $route->uri();
            
            // Only export API routes
            if (!str_starts_with($uri, 'api')) {
                continue;
            }

            $method = $route->methods()[0];
            
            if ($method === 'HEAD') {
                $method = $route->methods()[1] ?? 'GET';
            }

            $name = $route->getName() ?: $uri;
            
            // Convert {id} to :id for Postman variables
            $postmanUrl = str_replace('{', ':', $uri);
            $postmanUrl = str_replace('}', '', $postmanUrl);

            $pathParts = explode('/', $postmanUrl);

            $items[] = [
                'name' => $name,
                'request' => [
                    'method' => $method,
                    'header' => [
                        [
                            'key' => 'Accept',
                            'value' => 'application/json',
                            'type' => 'text'
                        ],
                        [
                            'key' => 'Authorization',
                            'value' => 'Bearer {{token}}',
                            'type' => 'text'
                        ]
                    ],
                    'url' => [
                        'raw' => '{{base_url}}/' . $postmanUrl,
                        'host' => ['{{base_url}}'],
                        'path' => $pathParts
                    ]
                ]
            ];
        }

        $collection = [
            'info' => [
                'name' => 'Inventory Management API',
                'schema' => 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
            ],
            'item' => $items,
            'variable' => [
                [
                    'key' => 'base_url',
                    'value' => 'http://127.0.0.1:8000'
                ],
                [
                    'key' => 'token',
                    'value' => 'your_access_token_here'
                ]
            ]
        ];

        $json = json_encode($collection, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        
        $path = base_path('postman_collection.json');
        file_put_contents($path, $json);
        
        $this->info('Postman collection exported to ' . $path);
    }
}
